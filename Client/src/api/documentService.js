const BASE_URL = import.meta.env.VITE_API_URL;

const getHeaders = (extraHeaders = {}) => {
  const username = sessionStorage.getItem('collab-username') || 'Unknown';
  return {
    'X-Username': username,
    ...extraHeaders
  };
};

const handleResponse = async (response) => {
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Something went wrong');
  }
  return response.json();
};

export const getDocuments = async () => {
  try {
    const response = await fetch(`${BASE_URL}/documents`, {
      headers: getHeaders()
    });
    const docs = await handleResponse(response);
    localStorage.setItem('docs_list_cache', JSON.stringify(docs));
    return docs;
  } catch (error) {
    const cached = localStorage.getItem('docs_list_cache');
    if (cached) {
      console.warn("Using offline cached document list.");
      return JSON.parse(cached);
    }
    throw error;
  }
};

export const createDocument = async (payload) => {
  const response = await fetch(`${BASE_URL}/documents`, {
    method: 'POST',
    headers: getHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
};

export const getDocument = async (id) => {
  try {
    const response = await fetch(`${BASE_URL}/documents/${id}`, {
      headers: getHeaders()
    });
    const doc = await handleResponse(response);
    localStorage.setItem(`doc_cache_${id}`, JSON.stringify(doc));
    return doc;
  } catch (error) {
    const cached = localStorage.getItem(`doc_cache_${id}`);
    if (cached) {
      console.warn("Using offline cached document details.");
      return JSON.parse(cached);
    }
    throw error;
  }
};

export const updateDocument = async (id, payload) => {
  const response = await fetch(`${BASE_URL}/documents/${id}`, {
    method: 'PUT',
    headers: getHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload), // Gửi toàn bộ payload (bao gồm title, publicAccess, sharedUsers)
  });
  return handleResponse(response);
};

export const deleteDocument = async (id) => {
    const response = await fetch(`${BASE_URL}/documents/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    return handleResponse(response);
};

export const getDocumentHistory = async (id) => {
    const response = await fetch(`${BASE_URL}/documents/${id}/history`, {
        headers: getHeaders()
    });
    return handleResponse(response);
};

export const getDocumentSnapshots = async (id) => {
    const response = await fetch(`${BASE_URL}/documents/${id}/snapshots`, {
        headers: getHeaders()
    });
    return handleResponse(response);
};

export const getSnapshotContent = async (documentId, snapshotId) => {
    const response = await fetch(`${BASE_URL}/documents/${documentId}/snapshots/${snapshotId}`, {
        headers: getHeaders()
    });
    return handleResponse(response);
};

export const restoreSnapshot = async (documentId, snapshotId) => {
    const response = await fetch(`${BASE_URL}/documents/${documentId}/restore/${snapshotId}`, {
        method: 'POST',
        headers: getHeaders(),
    });
    return handleResponse(response);
};
