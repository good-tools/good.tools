module.exports = {
  private: true,
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    [
      "@semantic-release/npm",
      {
        npmPublish: false,
      },
    ],
    [
      "@semantic-release/git",
      {
        assets: ["package.json", "CHANGELOG.md"],
        message: "chore(release): ${nextRelease.version} [skip ci]",
        successComment: false,
        failComment: false,
        failTitle: false,
        labels: false,
        releasedLabels: false,
      },
    ],
    [
      "@semantic-release/github",
      {
        assets: ["dist.tar.gz"],
        successComment: false,
        failComment: false,
        failTitle: false,
        labels: false,
        releasedLabels: false,
      },
    ],
    [
      "@semantic-release/exec",
      {
        prepareCmd: "bun run build && tar -czf dist.tar.gz dist/",
        successCmd: 'echo "released=1" >> ' + process.env.GITHUB_OUTPUT,
      },
    ],
  ],
};
