export const auth = { currentUser: { getIdToken: async () => 'good-' + (new URLSearchParams(location.search).get('u') || 'sub') } };
