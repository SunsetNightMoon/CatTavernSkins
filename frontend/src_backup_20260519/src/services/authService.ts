import axios from 'axios'
import type { RegisterDTO, LoginDTO } from '../types'

const API_BASE = '/api'

export const authService = {
  async register(data: RegisterDTO): Promise<any> {
    const response = await axios.post(`${API_BASE}/auth/register`, data)
    return response.data
  },

  async login(data: LoginDTO): Promise<any> {
    const response = await axios.post(`${API_BASE}/auth/login`, data)
    return response.data
  },

  async logout(): Promise<void> {
    // 清除本地存储的token
    localStorage.removeItem('auth-storage')
  },

  async getProfile(): Promise<any> {
    const response = await axios.get(`${API_BASE}/auth/profile`)
    return response.data
  },
}
