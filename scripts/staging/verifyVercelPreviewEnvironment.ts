import {
  auditVercelPreviewEnvironment,
  formatVercelEnvironmentAuditReport,
  parseEnvFile,
  type VercelEnvironmentMap,
} from "@/lib/server/vercelPreviewEnvironmentAudit";

type CliArgs = {
  previewEnvFile: string | null;
  productionEnvFile: string | null;
};

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    previewEnvFile: null,
    productionEnvFile: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--preview-env-file") {
      args.previewEnvFile = argv[index + 1] ?? null;
      index += 1;
    } else if (arg === "--production-env-file") {
      args.productionEnvFile = argv[index + 1] ?? null;
      index += 1;
    }
  }

  return args;
}

function readScopeEnv(filePath: string | null): VercelEnvironmentMap {
  return filePath ? parseEnvFile(filePath) : process.env;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = auditVercelPreviewEnvironment({
    preview: readScopeEnv(args.previewEnvFile),
    production: readScopeEnv(args.productionEnvFile),
  });

  console.log(formatVercelEnvironmentAuditReport(report));

  if (!report.ok) {
    process.exitCode = 1;
  }
}

main();
