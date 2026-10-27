require("dotenv").config({ quiet: true });

const app = require("./app");
const prisma = require("./config/database");
const { logger } = require("./config/observability");

const PORT = Number(process.env.PORT) || 5000;

async function startServer() {
  let server;
  let shuttingDown = false;

  try {
    await prisma.$connect();

    server = app.listen(PORT, () => {
      logger.info({ port: PORT }, "Amrutam API started");
    });

    const shutdown = (signal) => {
      if (shuttingDown) return;
      shuttingDown = true;

      logger.info({ signal }, "Graceful shutdown started");

      server.close(async (closeError) => {
        try {
          await prisma.$disconnect();

          if (closeError) {
            logger.error(
              { err: closeError },
              "HTTP server shutdown failed"
            );
            process.exitCode = 1;
          } else {
            logger.info("Graceful shutdown completed");
          }
        } catch (error) {
          logger.error(
            { err: error },
            "Database disconnect failed during shutdown"
          );
          process.exitCode = 1;
        }
      });
    };

    process.once("SIGINT", () => shutdown("SIGINT"));
    process.once("SIGTERM", () => shutdown("SIGTERM"));
  } catch (error) {
    logger.fatal({ err: error }, "Failed to start server");

    try {
      await prisma.$disconnect();
    } finally {
      process.exitCode = 1;
    }
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
