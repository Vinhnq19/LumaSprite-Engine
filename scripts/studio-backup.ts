export function backupInputs(files: { path: string; data: Buffer }[]) {
  const manifest = JSON.parse(files.find(file => file.path === 'pxl.project.json')!.data.toString('utf8'));
  const blobs: Record<string, string> = {}, resources: Record<string, string> = {};
  for (const file of files) {
    const cel = /^\.pxl\/cels\/([a-f0-9]{64})\.rgba\.z$/.exec(file.path);
    const resource = /^\.pxl\/resources\/([a-f0-9]{64})\.(rgba|mask|tile-index)\.z$/.exec(file.path);
    if (cel) blobs[cel[1]] = file.data.toString('base64');
    if (resource) resources[resource[2] + ':' + resource[1]] = file.data.toString('base64');
  }
  const history = files.filter(file => /^\.pxl\/pixel-history\/[^/]+\.json$/.test(file.path))
    .map(file => JSON.parse(file.data.toString('utf8')));
  return { document: manifest.document, blobs, resources, history };
}
