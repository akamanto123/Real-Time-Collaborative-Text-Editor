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
  const response = await fetch(`${BASE_URL}/documents`, {
    headers: getHeaders()
  });
  return handleResponse(response);
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
  const response = await fetch(`${BASE_URL}/documents/${id}`, {
    headers: getHeaders()
  });
  return handleResponse(response);
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
