import axios from 'axios';

export const API_BASE = 'https://danesh-health-backend.agreeableground-243793ea.northeurope.azurecontainerapps.io';

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

export const today = () => new Date().toISOString().slice(0, 10);
