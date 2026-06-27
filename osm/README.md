# OSM extracts for self-hosted Overpass

The `overpass` container (see `../docker-compose.yml`) builds its database from a
single merged extract, **`regions.osm.pbf`**. This dir holds the source country
extracts and the merged file. Large `.pbf` files are gitignored.

## Current coverage
- **Lithuania + Latvia** (`baltics.osm.pbf`, ~343 MB) — the original region.
- **Spain** (`spain-latest.osm.pbf`, ~1.35 GB) — mainland, Balearics, Canary
  Islands, Ceuta/Melilla. Added 2026-06-27.

Merged into `regions.osm.pbf` (~1.7 GB).

## Coverage bboxes
Keep these in sync with `LOCAL_BBOXES` in
`../backend/src/services/overpass.js` — that's what decides whether a query goes
to the local server or the public mirrors. `[south, west, north, east]`:
- Baltics: `53.8, 20.9, 58.2, 28.4`
- Spain mainland + Balearics + Ceuta/Melilla: `35.0, -9.6, 44.0, 4.5`
- Canary Islands: `27.4, -18.3, 29.5, -13.3`

## Rebuild the merged extract (add / refresh a region)
Download the country extract(s) from [Geofabrik](https://download.geofabrik.de),
then merge with osmium (bundled in the overpass image — no host install needed):

```bash
cd osm
# e.g. refresh Spain
curl -L -o spain-latest.osm.pbf https://download.geofabrik.de/europe/spain-latest.osm.pbf

# merge all regions into one (add more inputs to extend coverage)
MSYS_NO_PATHCONV=1 docker run --rm --entrypoint osmium \
  -v "$PWD:/osmdata" wiktorn/overpass-api \
  merge /osmdata/baltics.osm.pbf /osmdata/spain-latest.osm.pbf \
  -o /osmdata/regions.osm.pbf
```

Then rebuild the Overpass DB from the new extract (the named volume only builds
on first boot, so it must be wiped):

```bash
docker compose down
docker volume rm audioguide_overpass_db
docker compose up -d
# first boot rebuilds the DB — ~15-40 min for Spain. Watch: docker compose logs -f overpass
docker exec audioguide-overpass-1 chmod -R o+rX /db   # one-time perms fix after a fresh build
```

> `MSYS_NO_PATHCONV=1` is only needed on Git Bash for Windows (stops it
> rewriting the `/osmdata` paths). Harmless elsewhere.
