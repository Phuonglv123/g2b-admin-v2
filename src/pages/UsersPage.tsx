import { useState, useEffect } from "react"
import {
  Plus,
  Search,
  MoreHorizontal,
  Mail,
  Phone,
  Shield,
  Pencil,
  Trash2,
  KeyRound,
  X,
  UserCircle,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { checkSession } from "@/lib/supabase"
import {
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  getAllUsers,
} from "@/lib/userManagement"
import type { UserProfile, UserRole, UserStatus } from "@/types/user"

// Role and Status badge styles
const roleBadgeStyles: Record<UserRole, string> = {
  admin: "bg-purple-500/20 text-purple-400",
  manager: "bg-blue-500/20 text-blue-400",
  user: "bg-gray-500/20 text-gray-400",
}

const statusBadgeStyles: Record<UserStatus, string> = {
  active: "bg-green-500/20 text-green-400",
  inactive: "bg-gray-500/20 text-gray-400",
  suspended: "bg-red-500/20 text-red-400",
}

const roleLabels: Record<UserRole, string> = {
  admin: "Admin",
  manager: "Manager",
  user: "User",
}

const statusLabels: Record<UserStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  suspended: "Suspended",
}

// Modal Component
interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

const Modal = ({ isOpen, onClose, title, children }: ModalProps) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-card border border-border p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-secondary transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// Dropdown Menu Component
interface DropdownMenuProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}

const DropdownMenu = ({ isOpen, onClose, children }: DropdownMenuProps) => {
  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-xl bg-card border border-border shadow-lg py-1">
        {children}
      </div>
    </>
  )
}

interface DropdownItemProps {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}

const DropdownItem = ({ icon, label, onClick, danger }: DropdownItemProps) => (
  <button
    onClick={onClick}
    className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
      danger 
        ? "text-red-400 hover:bg-red-500/10" 
        : "text-foreground hover:bg-secondary"
    }`}
  >
    {icon}
    {label}
  </button>
)

// Form Input Component
interface FormInputProps {
  label: string
  name: string
  type?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  required?: boolean
  icon?: React.ReactNode
}

const FormInput = ({ 
  label, 
  name, 
  type = "text", 
  value, 
  onChange, 
  placeholder,
  required,
  icon
}: FormInputProps) => (
  <div className="space-y-2">
    <label className="text-sm font-medium text-muted-foreground">{label}</label>
    <div className="relative">
      {icon && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
          {icon}
        </div>
      )}
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className={`w-full h-11 rounded-xl border border-border bg-background text-sm outline-none focus:border-primary transition-colors ${
          icon ? "pl-11 pr-4" : "px-4"
        }`}
      />
    </div>
  </div>
)

// Form Select Component
interface FormSelectProps {
  label: string
  name: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  options: { value: string; label: string }[]
}

const FormSelect = ({ label, name, value, onChange, options }: FormSelectProps) => (
  <div className="space-y-2">
    <label className="text-sm font-medium text-muted-foreground">{label}</label>
    <select
      name={name}
      value={value}
      onChange={onChange}
      className="w-full h-11 rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </div>
)

// Initial form state
const initialFormState = {
  email: "",
  password: "",
  full_name: "",
  phone: "",
  role: "user" as UserRole,
  status: "active" as UserStatus,
}

const UsersPage = () => {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterRole, setFilterRole] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [fetchError, setFetchError] = useState("")
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  
  // Selected user for edit/delete
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
  
  // Form states
  const [formData, setFormData] = useState(initialFormState)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [formError, setFormError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Fetch users
  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      setFetchError("")

      const session = await checkSession()
      if (!session) {
        setFetchError("Session expired. Please log in again.")
        return
      }

      const { success, users: fetchedUsers, error } = await getAllUsers()

      if (!success || error) {
        console.error("Error fetching users:", error)
        setFetchError(error || "Failed to load users")
        return
      }
      
      setUsers(fetchedUsers || [])
    } catch (error) {
      console.error("Error fetching users:", error)
      setFetchError(error instanceof Error ? error.message : "Failed to load users")
    } finally {
      setLoading(false)
    }
  }

  // Filter users
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.phone?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesRole = filterRole === "all" || user.role === filterRole
    const matchesStatus = filterStatus === "all" || user.status === filterStatus
    
    return matchesSearch && matchesRole && matchesStatus
  })

  // Stats
  const stats = {
    total: users.length,
    active: users.filter((u) => u.status === "active").length,
    admins: users.filter((u) => u.role === "admin").length,
    suspended: users.filter((u) => u.status === "suspended").length,
  }

  // Handle form change
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    setFormError("")
  }

  // Add user
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError("")
    setSubmitting(true)

    try {
      // Validate password
      if (formData.password.length < 6) {
        setFormError("Password must be at least 6 characters")
        setSubmitting(false)
        return
      }

      // Create user using RPC function
      const result = await createUser({
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name || undefined,
        phone: formData.phone || undefined,
        role: formData.role as "admin" | "manager" | "user",
        status: formData.status as "active" | "inactive" | "suspended",
      })

      if (!result.success) {
        throw new Error(result.message || "Failed to create user")
      }

      await fetchUsers()
      setIsAddModalOpen(false)
      setFormData(initialFormState)
      alert("User created successfully!")
    } catch (error: unknown) {
      const err = error as Error
      setFormError(err.message || "Failed to create user")
    } finally {
      setSubmitting(false)
    }
  }

  // Edit user
  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return

    setFormError("")
    setSubmitting(true)

    try {
      // Update user using RPC function
      const result = await updateUser({
        user_id: selectedUser.id,
        full_name: formData.full_name || undefined,
        phone: formData.phone || undefined,
        role: formData.role as "admin" | "manager" | "user",
        status: formData.status as "active" | "inactive" | "suspended",
      })

      if (!result.success) {
        throw new Error(result.message || "Failed to update user")
      }

      await fetchUsers()
      setIsEditModalOpen(false)
      setSelectedUser(null)
      setFormData(initialFormState)
      alert("User updated successfully!")
    } catch (error: unknown) {
      const err = error as Error
      setFormError(err.message || "Failed to update user")
    } finally {
      setSubmitting(false)
    }
  }

  // Delete user
  const handleDeleteUser = async () => {
    if (!selectedUser) return

    setSubmitting(true)
    setFormError("")
    
    try {
      // Delete user using RPC function
      const result = await deleteUser(selectedUser.id)

      if (!result.success) {
        throw new Error(result.message || "Failed to delete user")
      }

      await fetchUsers()
      setIsDeleteModalOpen(false)
      setSelectedUser(null)
      alert("User deleted successfully!")
    } catch (error: unknown) {
      const err = error as Error
      setFormError(err.message || "Failed to delete user")
      alert(err.message || "Failed to delete user")
    } finally {
      setSubmitting(false)
    }
  }

  // Reset password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return

    setFormError("")

    if (newPassword !== confirmPassword) {
      setFormError("Passwords do not match")
      return
    }

    if (newPassword.length < 6) {
      setFormError("Password must be at least 6 characters")
      return
    }

    setSubmitting(true)

    try {
      // Reset password using RPC function
      const result = await resetUserPassword(selectedUser.id, newPassword)

      if (!result.success) {
        throw new Error(result.message || "Failed to reset password")
      }

      setIsPasswordModalOpen(false)
      setSelectedUser(null)
      setNewPassword("")
      setConfirmPassword("")
      alert("Password reset successfully!")
    } catch (error: unknown) {
      const err = error as Error
      setFormError(err.message || "Failed to reset password")
    } finally {
      setSubmitting(false)
    }
  }

  // Open edit modal
  const openEditModal = (user: UserProfile) => {
    setSelectedUser(user)
    setFormData({
      email: user.email,
      password: "",
      full_name: user.full_name || "",
      phone: user.phone || "",
      role: user.role,
      status: user.status,
    })
    setOpenDropdownId(null)
    setIsEditModalOpen(true)
  }

  // Open delete modal
  const openDeleteModal = (user: UserProfile) => {
    setSelectedUser(user)
    setOpenDropdownId(null)
    setIsDeleteModalOpen(true)
  }

  // Open password modal
  const openPasswordModal = (user: UserProfile) => {
    setSelectedUser(user)
    setNewPassword("")
    setConfirmPassword("")
    setOpenDropdownId(null)
    setIsPasswordModalOpen(true)
  }

  // Get user initials
  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    }
    return email.slice(0, 2).toUpperCase()
  }

  // Get avatar color based on role
  const getAvatarColor = (role: UserRole) => {
    const colors: Record<UserRole, string> = {
      admin: "from-purple-500 to-purple-600",
      manager: "from-blue-500 to-blue-600",
      user: "from-gray-500 to-gray-600",
    }
    return colors[role]
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users Management</h1>
          <p className="text-muted-foreground">
            Manage system users and permissions
          </p>
        </div>
        <Button 
          className="bg-primary text-white hover:bg-primary/90"
          onClick={() => {
            setFormData(initialFormState)
            setFormError("")
            setIsAddModalOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl bg-card border border-border p-5">
          <p className="text-sm text-muted-foreground">Total Users</p>
          <p className="mt-1 text-3xl font-bold">{stats.total}</p>
        </div>
        <div className="rounded-2xl bg-card border border-border p-5">
          <p className="text-sm text-muted-foreground">Active Users</p>
          <p className="mt-1 text-3xl font-bold text-green-400">{stats.active}</p>
        </div>
        <div className="rounded-2xl bg-card border border-border p-5">
          <p className="text-sm text-muted-foreground">Administrators</p>
          <p className="mt-1 text-3xl font-bold text-purple-400">{stats.admins}</p>
        </div>
        <div className="rounded-2xl bg-card border border-border p-5">
          <p className="text-sm text-muted-foreground">Suspended</p>
          <p className="mt-1 text-3xl font-bold text-red-400">{stats.suspended}</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-11 w-full sm:w-[300px] rounded-xl border border-border bg-card pl-11 pr-4 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="h-11 rounded-xl border border-border bg-card px-4 text-sm outline-none focus:border-primary appearance-none cursor-pointer min-w-[120px]"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="user">User</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-11 rounded-xl border border-border bg-card px-4 text-sm outline-none focus:border-primary appearance-none cursor-pointer min-w-[120px]"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : fetchError ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground px-6 text-center">
            <UserCircle className="h-12 w-12 mb-3" />
            <p className="mb-2">{fetchError}</p>
            <Button variant="outline" onClick={fetchUsers}>
              Retry
            </Button>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <UserCircle className="h-12 w-12 mb-3" />
            <p>No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt={user.full_name || user.email}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${getAvatarColor(user.role)} flex items-center justify-center text-white font-medium text-sm`}>
                            {getInitials(user.full_name, user.email)}
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{user.full_name || "No name"}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-4 w-4" />
                          <span className="truncate max-w-[180px]">{user.email}</span>
                        </div>
                        {user.phone && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="h-4 w-4" />
                            <span>{user.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${roleBadgeStyles[user.role]}`}>
                        <Shield className="h-3 w-3" />
                        {roleLabels[user.role]}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeStyles[user.status]}`}>
                        {statusLabels[user.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="px-6 py-4">
                      <div className="relative flex justify-end">
                        <button
                          onClick={() => setOpenDropdownId(openDropdownId === user.id ? null : user.id)}
                          className="rounded-lg p-2 hover:bg-secondary transition-colors"
                        >
                          <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
                        </button>
                        <DropdownMenu
                          isOpen={openDropdownId === user.id}
                          onClose={() => setOpenDropdownId(null)}
                        >
                          <DropdownItem
                            icon={<Pencil className="h-4 w-4" />}
                            label="Edit User"
                            onClick={() => openEditModal(user)}
                          />
                          <DropdownItem
                            icon={<KeyRound className="h-4 w-4" />}
                            label="Reset Password"
                            onClick={() => openPasswordModal(user)}
                          />
                          <DropdownItem
                            icon={<Trash2 className="h-4 w-4" />}
                            label="Delete User"
                            onClick={() => openDeleteModal(user)}
                            danger
                          />
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New User"
      >
        <form onSubmit={handleAddUser} className="space-y-4">
          <FormInput
            label="Email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleFormChange}
            placeholder="user@example.com"
            required
            icon={<Mail className="h-4 w-4" />}
          />
          <FormInput
            label="Password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleFormChange}
            placeholder="Minimum 6 characters"
            required
            icon={<KeyRound className="h-4 w-4" />}
          />
          <FormInput
            label="Full Name"
            name="full_name"
            value={formData.full_name}
            onChange={handleFormChange}
            placeholder="John Doe"
            icon={<UserCircle className="h-4 w-4" />}
          />
          <FormInput
            label="Phone"
            name="phone"
            value={formData.phone}
            onChange={handleFormChange}
            placeholder="+84 123 456 789"
            icon={<Phone className="h-4 w-4" />}
          />
          <div className="grid grid-cols-2 gap-4">
            <FormSelect
              label="Role"
              name="role"
              value={formData.role}
              onChange={handleFormChange}
              options={[
                { value: "user", label: "User" },
                { value: "manager", label: "Manager" },
                { value: "admin", label: "Admin" },
              ]}
            />
            <FormSelect
              label="Status"
              name="status"
              value={formData.status}
              onChange={handleFormChange}
              options={[
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
                { value: "suspended", label: "Suspended" },
              ]}
            />
          </div>

          {formError && (
            <p className="text-sm text-red-400">{formError}</p>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create User"
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit User"
      >
        <form onSubmit={handleEditUser} className="space-y-4">
          <FormInput
            label="Email"
            name="email"
            type="email"
            value={formData.email}
            onChange={() => {}}
            icon={<Mail className="h-4 w-4" />}
          />
          <FormInput
            label="Full Name"
            name="full_name"
            value={formData.full_name}
            onChange={handleFormChange}
            placeholder="John Doe"
            icon={<UserCircle className="h-4 w-4" />}
          />
          <FormInput
            label="Phone"
            name="phone"
            value={formData.phone}
            onChange={handleFormChange}
            placeholder="+84 123 456 789"
            icon={<Phone className="h-4 w-4" />}
          />
          <div className="grid grid-cols-2 gap-4">
            <FormSelect
              label="Role"
              name="role"
              value={formData.role}
              onChange={handleFormChange}
              options={[
                { value: "user", label: "User" },
                { value: "manager", label: "Manager" },
                { value: "admin", label: "Admin" },
              ]}
            />
            <FormSelect
              label="Status"
              name="status"
              value={formData.status}
              onChange={handleFormChange}
              options={[
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
                { value: "suspended", label: "Suspended" },
              ]}
            />
          </div>

          {formError && (
            <p className="text-sm text-red-400">{formError}</p>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete User"
      >
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Are you sure you want to delete this user?
          </p>
          {selectedUser && (
            <div className="flex items-center gap-4 rounded-xl bg-secondary/50 p-4">
              <div className={`h-12 w-12 rounded-full bg-gradient-to-br ${getAvatarColor(selectedUser.role)} flex items-center justify-center text-white font-medium`}>
                {getInitials(selectedUser.full_name, selectedUser.email)}
              </div>
              <div>
                <p className="font-medium">{selectedUser.full_name || "No name"}</p>
                <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
              </div>
            </div>
          )}
          <p className="text-sm text-red-400">
            This action cannot be undone. This will permanently delete the user account.
          </p>

          {formError && (
            <p className="text-sm text-red-400">{formError}</p>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteUser}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete User"
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        title="Reset Password"
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          {selectedUser && (
            <div className="flex items-center gap-4 rounded-xl bg-secondary/50 p-4 mb-4">
              <div className={`h-12 w-12 rounded-full bg-gradient-to-br ${getAvatarColor(selectedUser.role)} flex items-center justify-center text-white font-medium`}>
                {getInitials(selectedUser.full_name, selectedUser.email)}
              </div>
              <div>
                <p className="font-medium">{selectedUser.full_name || "No name"}</p>
                <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
              </div>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            A password reset email will be sent to the user's email address.
          </p>

          {formError && (
            <p className="text-sm text-red-400">{formError}</p>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPasswordModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Send Reset Email
                </>
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default UsersPage
