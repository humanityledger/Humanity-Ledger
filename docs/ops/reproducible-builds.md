# Reproducible builds

Goal: anyone can build a given commit and get the same JavaScript that ledgerchat.org serves, so
the code people read on GitHub is the code their browser runs. This is the first step: a way to
compare two builds. It is not enforced in CI yet, and the site does not publish a manifest yet.

## Compare two builds of one commit

```sh
git clone https://github.com/humanityledger/Humanity-Ledger && cd Humanity-Ledger
git checkout <commit>
npm ci --legacy-peer-deps
npm run build
node scripts/repro/hash-build.mjs .next > build-a.txt

# a second, clean build of the same commit (another folder, or another machine)
rm -rf .next && npm run build
node scripts/repro/hash-build.mjs .next > build-b.txt

diff build-a.txt build-b.txt && echo "Same output"
```

`hash-build.mjs` lists every file of the build with its SHA-256 and size, sorted by path. It
replaces the build id (random unless the build sets one) with `BUILD_ID`, and leaves out the build
cache, traces and server source maps, which carry timestamps and absolute paths.

## What can still differ today

- Environment variables read at build time (`NEXT_PUBLIC_*`): both builds need the same values.
- The Node.js and npm versions: use the ones CI uses (Node 22).
- `next.config` does not set `generateBuildId`, so the id differs between builds; the script
  normalises it. Setting it to the commit hash is the next step, once the deployment is checked
  with it.

## Next steps

1. Set the build id to the commit hash.
2. Run two builds in CI on every release tag and fail on a difference.
3. Publish the manifest of each release next to the release notes, and a page that compares it
   with the files the site serves.
