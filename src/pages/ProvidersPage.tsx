import { useState, useEffect } from 'react'
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Building2, 
  Phone,
  MapPin,
  Loader2,
  Truck,
  Hash
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { 
  getProviders, 
  createProvider, 
  updateProvider, 
  deleteProvider,
  generateProviderCode
} from '@/lib/customerProvider'
import { useAuth } from '@/contexts/AuthContext'
import type { Provider, CreateProviderParams } from '@/types/customer'

const ProvidersPage = () => {
  const { user } = useAuth()
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  
  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState<CreateProviderParams>({
    code: '',
    name: '',
    tax: '',
    address: '',
    phone: '',
    response: '',
    major: [],
    type: [],
    priority: 0,
    user_id: '',
    status: 1,
  })

  // Major options
  const majorOptions = ['Advertising', 'Printing', 'Events', 'Digital', 'Media', 'Design']
  // Type options  
  const typeOptions = ['Company', 'Individual', 'Freelancer', 'Agency']

  // Fetch providers
  const fetchProviders = async () => {
    try {
      setLoading(true)
      const data = await getProviders()
      setProviders(data)
    } catch (error) {
      console.error('Error fetching providers:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProviders()
  }, [])

  // Filter providers
  const filteredProviders = providers.filter(provider => {
    const matchesSearch = 
      provider.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      provider.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      provider.phone?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = filterStatus === 'all' || provider.status.toString() === filterStatus
    
    return matchesSearch && matchesStatus
  })

  // Handle create
  const handleCreate = async () => {
    if (!user) return
    try {
      setIsSubmitting(true)
      const code = await generateProviderCode()
      await createProvider({ ...formData, code, user_id: user.id })
      await fetchProviders()
      setIsCreateOpen(false)
      resetForm()
    } catch (error) {
      console.error('Error creating provider:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle update
  const handleUpdate = async () => {
    if (!selectedProvider) return
    try {
      setIsSubmitting(true)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { code, user_id, ...updateData } = formData
      await updateProvider({ id: selectedProvider.id, ...updateData })
      await fetchProviders()
      setIsEditOpen(false)
      resetForm()
    } catch (error) {
      console.error('Error updating provider:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle delete
  const handleDelete = async () => {
    if (!selectedProvider) return
    try {
      setIsSubmitting(true)
      await deleteProvider(selectedProvider.id)
      await fetchProviders()
      setIsDeleteOpen(false)
      setSelectedProvider(null)
    } catch (error) {
      console.error('Error deleting provider:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Reset form
  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      tax: '',
      address: '',
      phone: '',
      response: '',
      major: [],
      type: [],
      priority: 0,
      user_id: '',
      status: 1,
    })
    setSelectedProvider(null)
  }

  // Open edit dialog
  const openEditDialog = (provider: Provider) => {
    setSelectedProvider(provider)
    setFormData({
      code: provider.code,
      name: provider.name,
      tax: provider.tax || '',
      address: provider.address || '',
      phone: provider.phone || '',
      response: provider.response || '',
      major: provider.major || [],
      type: provider.type || [],
      priority: provider.priority || 0,
      user_id: provider.user_id,
      status: provider.status,
    })
    setIsEditOpen(true)
  }

  // Status badge variant
  const getStatusVariant = (status: number) => {
    switch (status) {
      case 1: return 'success'
      case 0: return 'secondary'
      case 2: return 'warning'
      default: return 'default'
    }
  }

  const getStatusLabel = (status: number) => {
    switch (status) {
      case 1: return 'Active'
      case 0: return 'Inactive'
      case 2: return 'Pending'
      default: return 'Unknown'
    }
  }

  // Handle multi-select
  const toggleArrayItem = (field: 'major' | 'type', item: string) => {
    const current = formData[field] || []
    if (current.includes(item)) {
      setFormData({ ...formData, [field]: current.filter(i => i !== item) })
    } else {
      setFormData({ ...formData, [field]: [...current, item] })
    }
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Providers</h1>
          <p className="text-muted-foreground">Manage service providers list</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Provider
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, code, phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="w-[150px]"
        >
          <option value="all">All Status</option>
          <option value="1">Active</option>
          <option value="0">Inactive</option>
          <option value="2">Pending</option>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Truck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{providers.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-500/10 p-2">
              <Building2 className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-2xl font-bold">{providers.filter(p => p.status === 1).length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-yellow-500/10 p-2">
              <Building2 className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold">{providers.filter(p => p.status === 2).length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-gray-500/10 p-2">
              <Building2 className="h-5 w-5 text-gray-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Inactive</p>
              <p className="text-2xl font-bold">{providers.filter(p => p.status === 0).length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Code</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Provider</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Contact</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Industry</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Priority</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredProviders.map((provider) => (
                <tr key={provider.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-sm">{provider.code}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{provider.name}</p>
                        {provider.tax && (
                          <p className="text-sm text-muted-foreground">MST: {provider.tax}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      {provider.phone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span>{provider.phone}</span>
                        </div>
                      )}
                      {provider.address && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span className="truncate max-w-[150px]">{provider.address}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {provider.major?.slice(0, 2).map((m, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {m}
                        </Badge>
                      ))}
                      {provider.major && provider.major.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{provider.major.length - 2}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{provider.priority || 0}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={getStatusVariant(provider.status)}>
                      {getStatusLabel(provider.status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(provider)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedProvider(provider)
                          setIsDeleteOpen(true)
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredProviders.length === 0 && (
          <div className="py-12 text-center">
            <Truck className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">No providers found</p>
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateOpen || isEditOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreateOpen(false)
          setIsEditOpen(false)
          resetForm()
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" onClose={() => {
          setIsCreateOpen(false)
          setIsEditOpen(false)
          resetForm()
        }}>
          <DialogHeader>
            <DialogTitle>
              {isEditOpen ? 'Edit Provider' : 'Add New Provider'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            {isEditOpen && (
              <div>
                <Label htmlFor="code">Provider Code</Label>
                <Input
                  id="code"
                  value={formData.code}
                  disabled
                  className="mt-1 bg-muted"
                />
              </div>
            )}

            <div className={isEditOpen ? '' : 'col-span-2'}>
              <Label htmlFor="name">Provider Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter provider name"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="0123-456-789"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="tax">Tax Code</Label>
              <Input
                id="tax"
                value={formData.tax}
                onChange={(e) => setFormData({ ...formData, tax: e.target.value })}
                placeholder="Tax code"
                className="mt-1"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Address"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="priority">Priority (0-10)</Label>
              <Input
                id="priority"
                type="number"
                min="0"
                max="10"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                id="status"
                value={formData.status?.toString()}
                onChange={(e) => setFormData({ ...formData, status: parseInt(e.target.value) })}
                className="mt-1"
              >
                <option value="1">Active</option>
                <option value="0">Inactive</option>
                <option value="2">Pending</option>
              </Select>
            </div>

            <div className="col-span-2">
              <Label>Industry</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {majorOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleArrayItem('major', option)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      formData.major?.includes(option)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border hover:bg-muted'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="col-span-2">
              <Label>Type</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {typeOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleArrayItem('type', option)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      formData.type?.includes(option)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border hover:bg-muted'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="col-span-2">
              <Label htmlFor="response">Person in Charge</Label>
              <Input
                id="response"
                value={formData.response}
                onChange={(e) => setFormData({ ...formData, response: e.target.value })}
                placeholder="Name of person in charge"
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateOpen(false)
                setIsEditOpen(false)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={isEditOpen ? handleUpdate : handleCreate}
              disabled={!formData.name || isSubmitting}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditOpen ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent onClose={() => setIsDeleteOpen(false)}>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Are you sure you want to delete provider <strong>{selectedProvider?.name}</strong> ({selectedProvider?.code})? 
            This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ProvidersPage
