// app/service-center/messages/page.tsx
"use client";

import { useState } from "react";
import useSWR from "swr";
import { useUIStore } from "@/store/ui-store";
import { FlexibleChat } from "@/components/widgets/flexible-chat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, MessageSquare, ShieldCheck, Building2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Client {
    client_id: number;
    client_name: string;
    primary_contact_email?: string;
}

export default function ServiceCenterMessages() {
    const currentServiceCenterId = useUIStore((s) => s.currentServiceCenterId);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("admin");

    // Fetch clients assigned to this service center
    const { data: clientsResponse, isLoading } = useSWR(
        currentServiceCenterId ? ["sc-clients", currentServiceCenterId] : null,
        async () => {
            const res = await fetch(`/api/clients/get-by-service-center?serviceCenterId=${currentServiceCenterId}`);
            const json = await res.json();
            return json;
        }
    );

    const clients: Client[] = clientsResponse?.data || [];

    // Filter clients based on search
    const filteredClients = clients.filter((client) =>
        client.client_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!currentServiceCenterId) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-muted-foreground">Loading...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Communicate with Admin and your assigned clients
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="admin" className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4" />
                        Chat with Admin
                    </TabsTrigger>
                    <TabsTrigger value="clients" className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Chat with Clients
                    </TabsTrigger>
                </TabsList>

                {/* ADMIN CHAT TAB */}
                <TabsContent value="admin" className="mt-4">
                    <Card>
                        <CardHeader className="border-b pb-3">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-violet-100 flex items-center justify-center">
                                    <ShieldCheck className="h-5 w-5 text-violet-600" />
                                </div>
                                <div>
                                    <CardTitle className="text-base">Admin Support</CardTitle>
                                    <p className="text-xs text-muted-foreground">
                                        Direct communication with the admin team
                                    </p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {/* Admin chat doesn't need clientId, using a special key */}
                            <FlexibleChat
                                clientId="0" // Admin-level chat
                                currentUserRole="SERVICE_CENTER"
                                recipients={[
                                    { role: "ADMIN", label: "Admin", color: "bg-violet-500" },
                                ]}
                                height="500px"
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* CLIENTS CHAT TAB */}
                <TabsContent value="clients" className="mt-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Client List Sidebar */}
                        <Card className="lg:col-span-1">
                            <CardHeader className="pb-3 border-b">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    Your Clients ({clients.length})
                                </CardTitle>
                                {/* Search */}
                                <div className="relative mt-3">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search clients..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-9"
                                    />
                                </div>
                            </CardHeader>
                            <CardContent className="p-0 max-h-[450px] overflow-y-auto">
                                {isLoading ? (
                                    <div className="p-4 text-sm text-muted-foreground text-center">
                                        Loading clients...
                                    </div>
                                ) : filteredClients.length === 0 ? (
                                    <div className="p-4 text-sm text-muted-foreground text-center">
                                        {searchQuery ? "No clients found" : "No clients assigned"}
                                    </div>
                                ) : (
                                    <div className="divide-y">
                                        {filteredClients.map((client) => (
                                            <button
                                                key={client.client_id}
                                                onClick={() => setSelectedClient(client)}
                                                className={cn(
                                                    "w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors",
                                                    selectedClient?.client_id === client.client_id && "bg-primary/5 border-l-4 border-primary"
                                                )}
                                            >
                                                <div className={cn(
                                                    "h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0",
                                                    selectedClient?.client_id === client.client_id
                                                        ? "bg-primary text-primary-foreground"
                                                        : "bg-blue-100 text-blue-700"
                                                )}>
                                                    {client.client_name.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={cn(
                                                        "font-medium truncate",
                                                        selectedClient?.client_id === client.client_id && "text-primary"
                                                    )}>
                                                        {client.client_name}
                                                    </p>
                                                    {client.primary_contact_email && (
                                                        <p className="text-xs text-muted-foreground truncate">
                                                            {client.primary_contact_email}
                                                        </p>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Chat Area */}
                        <div className="lg:col-span-2">
                            {selectedClient ? (
                                <FlexibleChat
                                    clientId={selectedClient.client_id.toString()}
                                    clientName={selectedClient.client_name}
                                    currentUserRole="SERVICE_CENTER"
                                    recipients={[
                                        { role: "CLIENT", label: selectedClient.client_name, color: "bg-blue-500" },
                                    ]}
                                    height="550px"
                                />
                            ) : (
                                <Card className="h-[550px] flex items-center justify-center">
                                    <div className="text-center space-y-3 opacity-50">
                                        <div className="bg-slate-200 p-4 rounded-full inline-block">
                                            <MessageSquare className="size-8 text-slate-500" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-900">Select a client to chat</p>
                                            <p className="text-sm text-slate-500">
                                                Choose a client from the list on the left
                                            </p>
                                        </div>
                                    </div>
                                </Card>
                            )}
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
