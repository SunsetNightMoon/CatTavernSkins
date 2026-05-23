import axios from 'axios'

const API_BASE = '/api'

function getToken(): string | null {
  const authStorage = localStorage.getItem('auth-storage')
  return authStorage ? JSON.parse(authStorage).state.token : null
}

export const profileService = {
  /**
   * 检查角色名是否可用
   */
  async checkNameAvailability(name: string): Promise<{ available: boolean; message: string }> {
    const response = await axios.get(`${API_BASE}/profiles/check-name`, {
      params: { name },
    })
    return response.data
  },

  /**
   * 更新角色名称（30天冷却）
   */
  async updateName(profileId: string, name: string): Promise<any> {
    const token = getToken()
    const response = await axios.put(
      `${API_BASE}/profiles/${profileId}/name`,
      { name },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    )
    return response.data
  },

  /**
   * 获取当前用户信息
   */
  async getMe(): Promise<any> {
    const token = getToken()
    const response = await axios.get(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    return response.data
  },

  /**
   * 应用皮肤到角色
   */
  async applySkin(profileId: string, skinId: number): Promise<any> {
    const token = getToken()
    const response = await axios.post(
      `${API_BASE}/user/profile/${profileId}/skin`,
      { skin_id: skinId },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    )
    return response.data
  },

  /**
   * 应用披风到角色
   */
  async applyCape(profileId: string, capeId: number): Promise<any> {
    const token = getToken()
    const response = await axios.post(
      `${API_BASE}/user/profile/${profileId}/cape`,
      { cape_id: capeId },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    )
    return response.data
  },

  /**
   * 移除角色皮肤
   */
  async removeSkin(profileId: string): Promise<any> {
    const token = getToken()
    const response = await axios.delete(
      `${API_BASE}/user/profile/${profileId}/skin`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    )
    return response.data
  },

  /**
   * 移除角色披风
   */
  async removeCape(profileId: string): Promise<any> {
    const token = getToken()
    const response = await axios.delete(
      `${API_BASE}/user/profile/${profileId}/cape`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    )
    return response.data
  },
}
