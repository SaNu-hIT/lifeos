// Conventional Commits enforcement — see docs/03_LifeOS_Engineering_Handbook.md §10
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-empty': [0],
  },
};
