import axios from 'axios';

const backend_url = 'https://wanted-backend-week4.vercel.app/';

const apiInstance = axios.create({
  baseURL: backend_url,
});

export function getDatas() {
  return apiInstance
    .get('/db.json', {})
    .then(res => res.data)
    .catch(() => {
      return [];
    });
}
