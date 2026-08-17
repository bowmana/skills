#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { text } from 'node:stream/consumers';
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  NameTakenError,
} from '../server/db.ts';

const USAGE = `mermaid-lite CLI

usage:
  ml list                                 list projects (alias: ls)
  ml create <name> [-f file.mmd]          create project (code from -f or piped stdin)
  ml get <name|id> [--json]               print project code (--json: full record)
  ml set <name|id> [-f file.mmd]          replace code from -f or piped stdin
  ml rename <name|id> <new-name>
  ml delete <name|id> [-y]                delete (alias: rm; -y skips confirm)
  ml render <name|id|file.mmd|-> [-o out.svg|out.png] [--theme t] [--scale n] [--url u]
                                          render via the real app pipeline;
                                          no -o prints SVG to stdout
  ml open <name|id>                       open a project in the browser
  ml scratch [file.mmd|-]                 open a TEMP diagram in the browser
                                          (in-memory only, not saved to sqlite;
                                          code from file or piped stdin)
  ml show <name|id|file.mmd>              AI-friendly review: prints metadata +
     [--scratch] [--code-only]            diagram code AND renders a fitted PNG,
                                          printing "image: <path>" at the end.
                                          --scratch reviews the last scratch
                                          diagram opened via \`ml scratch\`
  ml serve [--port 4680]                  start server (built app + API)
`;

function fail(message: string): never {
  console.error(`ml: ${message}`);
  process.exit(1);
}

function resolve(idOrName: string) {
  const project = getProject(idOrName);
  if (!project) {
    const names = listProjects().map((p) => p.name);
    const near = names.filter((n) => n.toLowerCase().includes(idOrName.toLowerCase()));
    fail(
      `no project "${idOrName}"` +
        (near.length ? `. Did you mean: ${near.join(', ')}?` : names.length ? `. Projects: ${names.join(', ')}` : ' (no projects yet)'),
    );
  }
  return project;
}

function relTime(ms: number): string {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

async function pipedStdin(): Promise<string | undefined> {
  return process.stdin.isTTY ? undefined : await text(process.stdin);
}

async function codeFrom(file: string | undefined): Promise<string | undefined> {
  if (file) return readFileSync(file, 'utf8');
  return pipedStdin();
}

const [cmd, ...rest] = process.argv.slice(2);

switch (cmd) {
  case 'list':
  case 'ls': {
    const projects = listProjects();
    if (projects.length === 0) {
      console.log('no projects yet — `ml create <name>` or use the web app');
      break;
    }
    const width = Math.max(...projects.map((p) => p.name.length)) + 2;
    for (const p of projects) {
      console.log(`${p.name.padEnd(width)}${relTime(p.updatedAt).padEnd(14)}${p.id}`);
    }
    break;
  }

  case 'create': {
    const { values, positionals } = parseArgs({
      args: rest,
      options: { file: { type: 'string', short: 'f' } },
      allowPositionals: true,
    });
    const name = positionals[0] ?? fail('usage: ml create <name> [-f file.mmd]');
    try {
      const project = createProject({ name, code: (await codeFrom(values.file)) ?? '' });
      console.log(`created "${project.name}" (${project.id})`);
    } catch (err) {
      if (err instanceof NameTakenError) fail(err.message);
      throw err;
    }
    break;
  }

  case 'get': {
    const { values, positionals } = parseArgs({
      args: rest,
      options: { json: { type: 'boolean' } },
      allowPositionals: true,
    });
    const project = resolve(positionals[0] ?? fail('usage: ml get <name|id> [--json]'));
    if (values.json) console.log(JSON.stringify(project, null, 2));
    else process.stdout.write(project.code);
    break;
  }

  case 'set': {
    const { values, positionals } = parseArgs({
      args: rest,
      options: { file: { type: 'string', short: 'f' } },
      allowPositionals: true,
    });
    const project = resolve(positionals[0] ?? fail('usage: ml set <name|id> [-f file.mmd]'));
    const code = await codeFrom(values.file);
    if (code === undefined) fail('no code given: pass -f file.mmd or pipe on stdin');
    updateProject(project.id, { code });
    console.log(`updated "${project.name}" (${code.length} chars)`);
    break;
  }

  case 'rename': {
    const [from, to] = rest;
    if (!from || !to) fail('usage: ml rename <name|id> <new-name>');
    const project = resolve(from);
    try {
      updateProject(project.id, { name: to });
      console.log(`renamed "${project.name}" → "${to}"`);
    } catch (err) {
      if (err instanceof NameTakenError) fail(err.message);
      throw err;
    }
    break;
  }

  case 'delete':
  case 'rm': {
    const { values, positionals } = parseArgs({
      args: rest,
      options: { yes: { type: 'boolean', short: 'y' } },
      allowPositionals: true,
    });
    const project = resolve(positionals[0] ?? fail('usage: ml delete <name|id> [-y]'));
    if (!values.yes) {
      if (!process.stdin.isTTY) fail('refusing to delete without -y in a non-interactive shell');
      const readline = await import('node:readline/promises');
      const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
      const answer = await rl.question(`delete "${project.name}"? [y/N] `);
      rl.close();
      if (answer.trim().toLowerCase() !== 'y') fail('aborted');
    }
    deleteProject(project.id);
    console.log(`deleted "${project.name}"`);
    break;
  }

  case 'render': {
    const { values, positionals } = parseArgs({
      args: rest,
      options: {
        out: { type: 'string', short: 'o' },
        theme: { type: 'string' },
        scale: { type: 'string' },
        url: { type: 'string' },
      },
      allowPositionals: true,
    });
    const { renderCmd } = await import('./render.ts');
    try {
      await renderCmd(positionals[0], {
        out: values.out,
        theme: values.theme,
        scale: values.scale ? Number(values.scale) : 2,
        url: values.url,
        stdinCode: await pipedStdin(),
      });
    } catch (err) {
      fail(String((err as Error).message ?? err));
    }
    break;
  }

  case 'open': {
    const project = resolve(rest[0] ?? fail('usage: ml open <name|id>'));
    const { ensureServer, openInBrowser } = await import('./browser.ts');
    try {
      const url = await ensureServer();
      openInBrowser(`${url}/?project=${project.id}`);
      console.log(`opened "${project.name}"`);
    } catch (err) {
      fail(String((err as Error).message ?? err));
    }
    break;
  }

  case 'scratch': {
    const { values, positionals } = parseArgs({
      args: rest,
      options: { file: { type: 'string', short: 'f' } },
      allowPositionals: true,
    });
    let code: string | undefined;
    const source = positionals[0];
    if (source && source !== '-') code = readFileSync(source, 'utf8');
    else code = (await codeFrom(values.file)) ?? undefined;
    if (code === undefined) fail('no code given: pass a file, -f file.mmd, or pipe on stdin');
    const { saveScratch } = await import('./scratchStore.ts');
    saveScratch(code); // so `ml show --scratch` can review it later
    const { ensureServer, openInBrowser } = await import('./browser.ts');
    try {
      const url = await ensureServer();
      const encoded = Buffer.from(code, 'utf8').toString('base64url');
      openInBrowser(`${url}/#scratch=${encoded}`);
      console.log('opened scratch diagram (not saved — use "Save as project" in the app to keep it)');
    } catch (err) {
      fail(String((err as Error).message ?? err));
    }
    break;
  }

  case 'show': {
    const { values, positionals } = parseArgs({
      args: rest,
      options: {
        scratch: { type: 'boolean' },
        'code-only': { type: 'boolean' },
      },
      allowPositionals: true,
    });

    let code: string;
    let theme = 'default';
    let slug: string;
    if (values.scratch) {
      const { readLastScratch } = await import('./scratchStore.ts');
      const last = readLastScratch();
      if (last === null) fail('no scratch diagram recorded yet (open one with `ml scratch`)');
      code = last;
      slug = 'scratch';
      console.log('# scratch (last opened via `ml scratch`; in-app edits are not captured)');
    } else {
      const source = positionals[0] ?? fail('usage: ml show <name|id|file.mmd> [--scratch] [--code-only]');
      const { existsSync } = await import('node:fs');
      if (existsSync(source)) {
        code = readFileSync(source, 'utf8');
        slug = source.replace(/.*\//, '').replace(/\.mmd$/, '');
        console.log(`# file: ${source}`);
      } else {
        const project = resolve(source);
        code = project.code;
        theme = project.theme;
        slug = project.name;
        console.log(
          `# project: ${project.name} (id ${project.id}, theme ${project.theme}, updated ${relTime(project.updatedAt)})`,
        );
      }
    }
    console.log('```mermaid');
    console.log(code.trimEnd());
    console.log('```');

    if (!values['code-only']) {
      const { mkdirSync } = await import('node:fs');
      const outDir = '/tmp/mermaid-lite';
      mkdirSync(outDir, { recursive: true });
      const out = `${outDir}/${slug.replace(/[^\w.-]+/g, '_')}.png`;
      const { renderCmd } = await import('./render.ts');
      try {
        await renderCmd(undefined, { out, theme, scale: 2, stdinCode: code });
        console.log(`image: ${out}`);
      } catch (err) {
        console.log(`image: RENDER FAILED — ${String((err as Error).message ?? err)}`);
      }
    }
    break;
  }

  case 'serve': {
    const { values } = parseArgs({
      args: rest,
      options: { port: { type: 'string' } },
    });
    if (values.port) process.env.ML_PORT = values.port;
    await import('../server/index.ts');
    break;
  }

  case undefined:
  case 'help':
  case '--help':
  case '-h':
    console.log(USAGE);
    break;

  default:
    fail(`unknown command "${cmd}"\n\n${USAGE}`);
}
