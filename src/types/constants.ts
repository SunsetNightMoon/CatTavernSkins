/**
 * 项目常量定义
 * 避免魔法数字，统一枚举值
 */

export const UserLevel = {
  USER: 0,
  ADMIN: 1,
  SUPER_ADMIN: 2,
} as const

export const UserRole = {
  USER: 'user',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
} as const

export const ApprovalStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const

export const PermissionLevel = {
  PRIVATE: 'private',
  PUBLIC_NO_DOWNLOAD: 'public_no_download',
  PUBLIC_DOWNLOADABLE: 'public_downloadable',
} as const

export const LicenseType = {
  ALL_RIGHTS_RESERVED: 'ARR',
  ATTRIBUTION: 'BY',
  SHARE_ALIKE: 'SA',
  PUBLIC_DOMAIN: 'PD',
} as const

// 文件大小限制
export const MAX_SKIN_SIZE = 2 * 1024 * 1024 // 2MB
export const MAX_CAPE_SIZE = 1 * 1024 * 1024 // 1MB

// 分页默认值
export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100
