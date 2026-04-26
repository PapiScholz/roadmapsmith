// workspace package: auth module
function authenticateUser(credentials) {
  if (!credentials || !credentials.token) return false;
  return credentials.token.length > 0;
}

module.exports = { authenticateUser };
