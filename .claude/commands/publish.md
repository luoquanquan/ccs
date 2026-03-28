Publish a new version of ccs. Accepts `$ARGUMENTS` as the version bump type: `patch` (default), `minor`, `major`, or an explicit version like `1.2.3`.

Steps:
1. Run the full test suite — abort if any test fails
2. Bump the version in `package.json` using `npm version`
3. Commit and tag via git, then push branch + tags
4. Publish to npm

```bash
bash scripts/publish.sh ${ARGUMENTS:-patch}
```
