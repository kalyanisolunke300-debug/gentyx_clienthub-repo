"use client"

import { useState } from "react"
import useSWR from "swr"
import { fetchAuditLogs } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { User, Bell, Shield, Activity, Save, Eye, EyeOff, Check } from "lucide-react"

export default function SettingsPage() {
  const { toast } = useToast()
  const { data: auditsResponse } = useSWR(["audits"], () => fetchAuditLogs())

  // Fix: Extract data array from response
  const audits = Array.isArray(auditsResponse?.data) ? auditsResponse.data : []

  // Profile state
  const [profileData, setProfileData] = useState({
    name: "Admin User",
    email: "admin@mail.com",
    phone: "",
    role: "Administrator"
  })

  // Notification settings state
  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    taskUpdates: true,
    clientUpdates: true,
    weeklyDigest: false,
    messageNotifications: true
  })

  // Secret visibility
  const [showSecret, setShowSecret] = useState(false)
  const [secretValue, setSecretValue] = useState("")

  // Save handlers
  const handleSaveProfile = () => {
    toast({
      title: "Profile Updated",
      description: "Your profile settings have been saved successfully.",
    })
  }

  const handleSaveNotifications = () => {
    toast({
      title: "Notifications Updated",
      description: "Your notification preferences have been saved.",
    })
  }

  const handleSubmitSecret = () => {
    if (!secretValue.trim()) {
      toast({
        title: "Error",
        description: "Please enter a secret value.",
        variant: "destructive"
      })
      return
    }
    toast({
      title: "Secret Stored",
      description: "Your secret has been securely stored.",
    })
    setSecretValue("")
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Manage your account settings and preferences</p>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-[500px]">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Audit Log</span>
          </TabsTrigger>
        </TabsList>

        {/* ============ PROFILE TAB ============ */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Profile Information
              </CardTitle>
              <CardDescription>Update your personal information and account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    placeholder="Enter your name"
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    placeholder="Enter your phone number"
                    value={profileData.phone}
                    onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Input
                    id="role"
                    value={profileData.role}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveProfile} className="gap-2">
                  <Save className="h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ NOTIFICATIONS TAB ============ */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Notification Preferences
              </CardTitle>
              <CardDescription>Configure how you receive notifications and alerts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label className="text-base">Email Alerts</Label>
                    <p className="text-sm text-muted-foreground">Receive email notifications for important updates</p>
                  </div>
                  <Switch
                    checked={notifications.emailAlerts}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, emailAlerts: checked })}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label className="text-base">Task Updates</Label>
                    <p className="text-sm text-muted-foreground">Get notified when tasks are assigned or completed</p>
                  </div>
                  <Switch
                    checked={notifications.taskUpdates}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, taskUpdates: checked })}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label className="text-base">Client Updates</Label>
                    <p className="text-sm text-muted-foreground">Notifications for client onboarding progress changes</p>
                  </div>
                  <Switch
                    checked={notifications.clientUpdates}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, clientUpdates: checked })}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label className="text-base">Message Notifications</Label>
                    <p className="text-sm text-muted-foreground">Get notified when you receive new messages</p>
                  </div>
                  <Switch
                    checked={notifications.messageNotifications}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, messageNotifications: checked })}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label className="text-base">Weekly Digest</Label>
                    <p className="text-sm text-muted-foreground">Receive a weekly summary of activity</p>
                  </div>
                  <Switch
                    checked={notifications.weeklyDigest}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, weeklyDigest: checked })}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveNotifications} className="gap-2">
                  <Check className="h-4 w-4" />
                  Save Preferences
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ SECURITY TAB ============ */}
        <TabsContent value="security">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Password & Security
                </CardTitle>
                <CardDescription>Manage your password and security settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Current Password</Label>
                    <Input id="current-password" type="password" placeholder="Enter current password" />
                  </div>
                  <div></div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input id="new-password" type="password" placeholder="Enter new password" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input id="confirm-password" type="password" placeholder="Confirm new password" />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button variant="outline">Update Password</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Credentials Vault</CardTitle>
                <CardDescription>Securely store sensitive credentials (one-time visibility)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Input
                    type={showSecret ? "text" : "password"}
                    placeholder="Enter secret value"
                    value={secretValue}
                    onChange={(e) => setSecretValue(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-md">
                  ⚠️ Warning: Secrets are encrypted and only visible once on submission. Make sure to save them securely.
                </p>
                <div className="flex justify-end">
                  <Button onClick={handleSubmitSecret}>Store Secret</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============ AUDIT LOG TAB ============ */}
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Activity Audit Log
              </CardTitle>
              <CardDescription>View recent activity and system changes</CardDescription>
            </CardHeader>
            <CardContent>
              {audits.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="bg-muted/50 rounded-full p-3 mb-3">
                    <Activity className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">No audit logs available yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {audits.slice(0, 20).map((a: any, index: number) => (
                    <div
                      key={a.id || index}
                      className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-2 w-2 rounded-full ${a.action?.includes('CREATE') ? 'bg-green-500' :
                            a.action?.includes('UPDATE') ? 'bg-blue-500' :
                              a.action?.includes('DELETE') ? 'bg-red-500' :
                                'bg-gray-500'
                          }`} />
                        <div>
                          <p className="font-medium text-sm">{a.action}</p>
                          <p className="text-xs text-muted-foreground">
                            By {a.actorRole || a.actor_role || 'System'}
                          </p>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground text-right">
                        {a.at || a.created_at ? new Date(a.at || a.created_at).toLocaleString() : '-'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
