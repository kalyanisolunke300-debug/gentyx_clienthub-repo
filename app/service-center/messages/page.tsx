// app/service-center/messages/page.tsx
"use client";

import { useState } from "react";
import useSWR from "swr";
import { FlexibleChat } from "@/components/widgets/flexible-chat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUIStore } from "@/store/ui-store";
import { Users, MessageSquare, Search, Building2, Shield } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Client {
    client_id: number;
    client_name: string;
    primary_contact_email?: string;
}

export default function ServiceCenterMessages() {
    const currentServiceCenterId = useUIStore((s) => s.currentServiceCenterId);
    const [activeTab, setActiveTab] = useState("clients");
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [clientSearch, setClientSearch] = useState("");

    // Fetch clients assigned to this Service Center
    const { data: clientsData, isLoading: clientsLoading } = useSWR(
        currentServiceCenterId ? ["sc-clients-messages", currentServiceCenterId] : null,
        async () => {
            const res = await fetch(`/api/clients/get-by-service-center?serviceCenterId=${currentServiceCenterId}`);
            const json = await res.json();
            return { data: json.data || [] };
        }
    );

    const clients: Client[] = clientsData?.data || [];

    // Filter clients
    const filteredClients = clients.filter((c) =>
        c.client_name.toLowerCase().includes(clientSearch.toLowerCase())
    );

    if (!currentServiceCenterId) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-3 text-muted-foreground">Loading...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                    <MessageSquare className="h-6 w-6 text-primary" />
                    Messages
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Communicate with Admin and your assigned clients
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="admin" className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Chat with Admin
                    </TabsTrigger>
                    <TabsTrigger value="clients" className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Chat with Clients
                    </TabsTrigger>
                </TabsList>

                {/* ADMIN TAB */}
                <TabsContent value="admin" className="mt-4">
                    <FlexibleChat
                        clientId="0"
                        serviceCenterId={currentServiceCenterId}
                        currentUserRole="SERVICE_CENTER"
                        recipients={[
                            { role: "ADMIN", label: "Admin", color: "bg-violet-500" },
                        ]}
                        height="600px"
                    />
                </TabsContent>

                {/* CLIENTS TAB */}
                <TabsContent value="clients" className="mt-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Client List */}
                        <Card className="lg:col-span-1">
                            <CardHeader className="pb-3 border-b">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Users className="h-4 w-4 text-blue-600" />
                                    Clients ({clients.length})
                                </CardTitle>
                                <div className="relative mt-3">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search clients..."
                                        value={clientSearch}
                                        onChange={(e) => setClientSearch(e.target.value)}
                                        className="pl-9"
                                    />
                                </div>
                            </CardHeader>
                            <CardContent className="p-0 max-h-[500px] overflow-y-auto">
                                {clientsLoading ? (
                                    <div className="p-4 text-sm text-muted-foreground text-center">Loading...</div>
                                ) : filteredClients.length === 0 ? (
                                    <div className="p-4 text-sm text-muted-foreground text-center">
                                        {clients.length === 0 ? "No clients assigned" : "No clients found"}
                                    </div>
                                ) : (
                                    <div className="divide-y">
                                        {filteredClients.map((client) => (
                                            <button
                                                key={client.client_id}
                                                onClick={() => setSelectedClient(client)}
                                                className={cn(
                                                    "w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors",
                                                    selectedClient?.client_id === client.client_id && "bg-blue-50 border-l-4 border-blue-500"
                                                )}
                                            >
                                                <div className={cn(
                                                    "h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0",
                                                    selectedClient?.client_id === client.client_id
                                                        ? "bg-blue-500 text-white"
                                                        : "bg-blue-100 text-blue-700"
                                                )}>
                                                    {client.client_name.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={cn(
                                                        "font-medium truncate",
                                                        selectedClient?.client_id === client.client_id && "text-blue-700"
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
                                        { role: "ADMIN", label: "Admin", color: "bg-violet-500" },
                                    ]}
                                    height="600px"
                                />
                            ) : (
                                <Card className="h-[600px] flex items-center justify-center">
                                    <div className="text-center space-y-3 opacity-50">
                                        <div className="bg-emerald-100 p-4 rounded-full inline-block">
                                            <Building2 className="size-8 text-emerald-500" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-900">Select a client to chat</p>
                                            <p className="text-sm text-slate-500">Choose from the list on the left</p>
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
