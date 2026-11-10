// Loaded by the new tab page, the toolbar popup and the content script (palette).

// Quick-actions palette rules: page URL regex -> link template ($1, $2… = capture groups).
// Matches any GitLab project page: $1 = group path, $2 = project.
const GITLAB_PROJECT_PAGE = '^https://gitlab\\.com/(?!groups/)((?:[^/]+/)*[^/]+)/([^/]+)/-/';

const DEFAULT_SETTINGS = {
  version: 1,
  gridColumns: 3,
  gridRows: 2,
  background: {
    type: 'solid',
    color: '#0f1114',
    gradientFrom: '#0f1114',
    gradientTo: '#1a2332',
    gradientAngle: 135,
  },
  clock: {
    format: '24h',
    showDate: false,
    position: 'top-center',
  },
  groups: [],
  rules: [
    { id: 'r-gitlab-group-mrs', name: 'Group merge requests', match: GITLAB_PROJECT_PAGE,
      url: 'https://gitlab.com/groups/$1/-/merge_requests' },
    { id: 'r-gitlab-project-mrs', name: 'Project merge requests', match: GITLAB_PROJECT_PAGE,
      url: 'https://gitlab.com/$1/$2/-/merge_requests' },
    { id: 'r-gitlab-project-pipelines', name: 'Project pipelines', match: GITLAB_PROJECT_PAGE,
      url: 'https://gitlab.com/$1/$2/-/pipelines' },
  ],
};

const Storage = {
  // Saved settings with defaults filled in for any top-level key they lack
  // (first run, settings saved by an older version, an imported file).
  async load() {
    const { settings } = await chrome.storage.local.get('settings');
    return { ...structuredClone(DEFAULT_SETTINGS), ...settings };
  },

  async save(settings) {
    await chrome.storage.local.set({ settings });
  },
};
