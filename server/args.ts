import path from "node:path";

export interface ParsedArgs {
  workingDirectory: string;
}

export function parse(argv: string[]) {
  const pathArgv = argv.slice(2).at(0);
  const absoluteWorkingDirectory = pathArgv ? ensureAbsolutePath(pathArgv!, process.cwd()) : process.cwd();

  return { absoluteWorkingDirectory };
}

function ensureAbsolutePath(maybeRelative: string, cwd: string) {
  return path.isAbsolute(maybeRelative) ? maybeRelative : path.resolve(cwd, maybeRelative);
}
