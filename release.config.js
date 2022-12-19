module.exports =  {
  "private": true,
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    ["@semantic-release/npm", {
      "npmPublish": false
    }],
    ["@semantic-release/git", {
      "assets": ["package.json", "CHANGELOG.md"],
      "message": "chore(release): ${nextRelease.version} [skip ci]",
      "successComment": false,
      "failComment": false,
      "failTitle": false,
      "labels": false,
      "releasedLabels": false
    }],
    ["@semantic-release/github", {
      "assets": ["build.tar.gz"],
      "successComment": false,
      "failComment": false,
      "failTitle": false,
      "labels": false,
      "releasedLabels": false
    }],
    ["@semantic-release/exec", {
      "prepareCmd": "CI=false npm run build && tar -czf build.tar.gz build/",
      "successCmd": "echo \"released=1\" >> " + process.env.GITHUB_OUTPUT
    }],
  ]
}