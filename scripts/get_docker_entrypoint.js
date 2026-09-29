const fs = require('fs');

async function getManifest() {
  const tokenRes = await fetch('https://auth.docker.io/token?service=registry.docker.io&scope=repository:azteclabs/aztec:pull');
  const { token } = await tokenRes.json();
  
  const manifestRes = await fetch('https://registry-1.docker.io/v2/aztecprotocol/aztec/manifests/latest', {
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.docker.distribution.manifest.v2+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.index.v1+json'
    }
  });
  
  const manifest = await manifestRes.json();
  let configDigest;
  
  if (manifest.manifests) {
    const digest = manifest.manifests[0].digest;
    const configRes = await fetch('https://registry-1.docker.io/v2/aztecprotocol/aztec/manifests/' + digest, {
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json'
      }
    });
    const configManifest = await configRes.json();
    configDigest = configManifest.config.digest;
  } else {
    configDigest = manifest.config.digest;
  }
  
  const finalRes = await fetch('https://registry-1.docker.io/v2/aztecprotocol/aztec/blobs/' + configDigest, {
    headers: { Authorization: 'Bearer ' + token }
  });
  
  const finalConfig = await finalRes.json();
  console.log('ENTRYPOINT:', finalConfig.config.Entrypoint);
  console.log('CMD:', finalConfig.config.Cmd);
}

getManifest().catch(console.error);
