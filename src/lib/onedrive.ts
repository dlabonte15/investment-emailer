/**
 * Fetch a file from OneDrive via Microsoft Graph API.
 * Returns the file content as a Buffer.
 */
export async function fetchOneDriveFile(
  accessToken: string,
  fileId: string
): Promise<{ buffer: Buffer; fileName: string }> {
  // Get file metadata first (for the filename)
  const metaRes = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!metaRes.ok) {
    const error = await metaRes.json().catch(() => ({}));
    throw new Error(
      `Failed to get file metadata: ${error.error?.message || metaRes.statusText}`
    );
  }

  const meta = await metaRes.json();
  const fileName = meta.name || "OneDriveFile.xlsx";

  // Download file content
  const contentRes = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!contentRes.ok) {
    const error = await contentRes.json().catch(() => ({}));
    throw new Error(
      `Failed to download file: ${error.error?.message || contentRes.statusText}`
    );
  }

  const arrayBuffer = await contentRes.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), fileName };
}

/**
 * Search for a file on OneDrive by path.
 * Returns the item ID if found.
 */
export async function findOneDriveFile(
  accessToken: string,
  filePath: string
): Promise<{ id: string; name: string } | null> {
  // Encode the path for the Graph API
  const encodedPath = encodeURIComponent(filePath).replace(/%2F/g, "/");

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/root:/${encodedPath}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    if (res.status === 404) return null;
    const error = await res.json().catch(() => ({}));
    throw new Error(
      `Failed to find file: ${error.error?.message || res.statusText}`
    );
  }

  const item = await res.json();
  return { id: item.id, name: item.name };
}
