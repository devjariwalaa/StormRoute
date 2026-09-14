# Deployment

The application is compatible with Vercel's Next.js runtime. `vercel.json` caps the analyze handler at 60 seconds. No database or paid API key is required for the non-commercial demo. Use a free personal/Hobby deployment; do not enable a paid plan to run this project.

Local startup: `npm install`, `npm run build`, `npm start`. Development: `npm run dev`. The repository `.npmrc` keeps the npm cache inside this repo.

For a durable Vercel deployment, sign in through Vercel and deploy the repo. An unauthenticated temporary deployment may be available through the CLI but must be claimed before its reported expiration. Never commit `.vercel-auth`, `.vercel`, or tokens; they are ignored along with the npm cache and scratch files. Deployment source exclusions are in `.vercelignore`.

`ROUTING_BASE_URL` can point to a compatible OSRM service you operate or have permission to use. `NEXT_PUBLIC_TILE_URL` can switch the raster tile source; update attribution in the map component to match the new provider. Defaults are keyless. There is no secret-bearing environment file.

## Public-provider operating boundary

The default FOSSGIS service permits light use and limits routing requests to one per second. The app's process-local gate respects that limit within a single instance. Autoscaled instances do **not** share that gate, cache, budget, or analysis-capacity counter. Keep a preview lightly used, avoid load-testing public endpoints, and use shared rate coordination plus an appropriate routing backend before broad distribution. A successful Vercel build does not change this limit.

## Post-deployment verification

Verify `/api/health`, load the homepage, and submit Ann Arbor, MI → Chicago, IL for a future departure. Confirm a complete forecast, actual road geometry, departure switching, visible attribution, and no diagnostics in production. A routing/geocoding success with incomplete weather does not count as a complete live pipeline test. Record the actual URL and test timestamp in `measurements/deployment.json` after success.
