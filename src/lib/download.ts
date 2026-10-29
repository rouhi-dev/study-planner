/**
 * Save a text file. Uses the Claude artifact `downloads` capability when the
 * app runs as a published artifact (where plain downloads are blocked), and a
 * normal browser download everywhere else.
 */
interface DownloadsNamespace {
  save(args: { filename: string; data: Blob | string }): Promise<unknown>;
}
interface Runtime {
  use(name: 'downloads'): Promise<DownloadsNamespace | null>;
}

export async function downloadText(filename: string, text: string, mime = 'application/json'): Promise<'saved' | 'browser'> {
  const runtime = (globalThis as { claude?: Runtime }).claude;
  if (runtime?.use) {
    const downloads = await runtime.use('downloads').catch(() => null);
    if (downloads) {
      await downloads.save({ filename, data: new Blob([text], { type: mime }) });
      return 'saved';
    }
  }
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'browser';
}
