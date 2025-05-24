const {GoogleAuth} = require('google-auth-library');

/**
* Instead of specifying the type of client you'd like to use (JWT, OAuth2, etc)
* this library will automatically choose the right client based on the environment.
*/
async function main() {
  const auth = new GoogleAuth({
    scopes: 'https://mail.google.com/'
  });
  const client = await auth.getClient();
  //const projectId = await auth.getProjectId();
  const url = `dynamic url of api calls`;
  const res = await client.request({
       url
    });
  console.log(res.data);
}

main().catch(console.error);