declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    REPO_ENCRYPTION_KEY?: string;
    ADMIN_EMAIL?: string;
  }
}
