Analyze current git changes, create a conventional commit, and push to GitHub.

Steps:
1. Run `git status` and `git diff` to understand what changed
2. Stage all modified/new files (excluding secrets like .env)
3. Generate a conventional commit message based on the diff
4. Commit and push to origin

```bash
git status --porcelain
git diff
```

Then stage and commit:

```bash
git add <relevant files>
git commit -m "<type>[scope]: <description>"
git push
```

Commit type guide: feat / fix / docs / refactor / test / chore / perf / ci

Rules:
- Never stage .env or credential files
- Never use --no-verify or --force
- Never force push to main
- If nothing to commit, say so and stop
