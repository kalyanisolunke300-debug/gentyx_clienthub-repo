// app/admin/messages/page.tsx
"use client";

import { useState } from "react";
import useSWR from "swr";
import { FlexibleChat } from "@/components/widgets/flexible-chat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, MessageSquare, Building2, Landmark, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { fetchClients, fetchServiceCenters, fetchCPAs } from "@/lib/api";

interface Client {
    client_id: number;
    client_name: string;
    primary_contact_email?: string;
}

interface ServiceCenter {
    service_center_id: number;
    center_name: string;
    center_code?: string;
    email?: string;
}

interface CPA {
    cpa_id: number;
    cpa_name: string;
    email?: string;
}

export default function AdminMessages() {
    const [activeTab, setActiveTab] = useState("clients");

    // Client states
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [clientSearch, setClientSearch] = useState("");

    // Service Center states
    const [selectedSC, setSelectedSC] = useState<ServiceCenter | null>(null);
    const [scSearch, setSCSearch] = useState("");

    // CPA states
    const [selectedCPA, setSelectedCPA] = useState<CPA | null>(null);
    const [cpaSearch, setCPASearch] = useState("");

    // Fetch all clients
    const { data: clientsResponse, isLoading: clientsLoading } = useSWR(
        "all-clients",
        async () => {
            const res = await fetchClients({ page: 1, pageSize: 500, q: "" });
            return res;
        }
    );
    const clients: Client[] = clientsResponse?.data || [];

    // Fetch all service centers
    const { data: scResponse, isLoading: scLoading } = useSWR(
        "all-service-centers",
        async () => {
            const res = await fetchServiceCenters();
            return res;
        }
    );
    const serviceCenters: ServiceCenter[] = scResponse?.data || [];

    // Fetch all CPAs
    const { data: cpaResponse, isLoading: cpaLoading } = useSWR(
        "all-cpas",
        async () => {
            const res = await fetchCPAs();
            return res;
        }
    );
    const cpas: CPA[] = cpaResponse?.data || [];

    // Filter functions
    const filteredClients = clients.filter((c) =>
        c.client_name.toLowerCase().includes(clientSearch.toLowerCase())
    );

    const filteredSCs = serviceCenters.filter((sc) =>
        sc.center_name.toLowerCase().includes(scSearch.toLowerCase())
    );

    const filteredCPAs = cpas.filter((cpa) =>
        cpa.cpa_name.toLowerCase().includes(cpaSearch.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Communicate with clients, service centers, and CPAs
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full max-w-2xl grid-cols-3">
                    <TabsTrigger value="clients" className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Chat with Clients
                    </TabsTrigger>
                    <TabsTrigger value="service-centers" className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Chat with Service Centers
                    </TabsTrigger>
                    <TabsTrigger value="cpas" className="flex items-center gap-2">
                        <Landmark className="h-4 w-4" />
                        Chat with CPAs
                    </TabsTrigger>
                </TabsList>

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
                            <CardContent className="p-0 max-h-[450px] overflow-y-auto">
                                {clientsLoading ? (
                                    <div className="p-4 text-sm text-muted-foreground text-center">Loading...</div>
                                ) : filteredClients.length === 0 ? (
                                    <div className="p-4 text-sm text-muted-foreground text-center">No clients found</div>
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

                        {/* Client Chat Area */}
                        <div className="lg:col-span-2">
                            {selectedClient ? (
                                <FlexibleChat
                                    clientId={selectedClient.client_id.toString()}
                                    clientName={selectedClient.client_name}
                                    currentUserRole="ADMIN"
                                    recipients={[
                                        { role: "CLIENT", label: selectedClient.client_name, color: "bg-blue-500" },
                                    ]}
                                    height="550px"
                                />
                            ) : (
                                <Card className="h-[550px] flex items-center justify-center">
                                    <div className="text-center space-y-3 opacity-50">
                                        <div className="bg-blue-100 p-4 rounded-full inline-block">
                                            <Users className="size-8 text-blue-500" />
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

                {/* SERVICE CENTERS TAB */}
                <TabsContent value="service-centers" className="mt-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* SC List */}
                        <Card className="lg:col-span-1">
                            <CardHeader className="pb-3 border-b">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-emerald-600" />
                                    Service Centers ({serviceCenters.length})
                                </CardTitle>
                                <div className="relative mt-3">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search service centers..."
                                        value={scSearch}
                                        onChange={(e) => setSCSearch(e.target.value)}
                                        className="pl-9"
                                    />
                                </div>
                            </CardHeader>
                            <CardContent className="p-0 max-h-[450px] overflow-y-auto">
                                {scLoading ? (
                                    <div className="p-4 text-sm text-muted-foreground text-center">Loading...</div>
                                ) : filteredSCs.length === 0 ? (
                                    <div className="p-4 text-sm text-muted-foreground text-center">No service centers found</div>
                                ) : (
                                    <div className="divide-y">
                                        {filteredSCs.map((sc) => (
                                            <button
                                                key={sc.service_center_id}
                                                onClick={() => setSelectedSC(sc)}
                                                className={cn(
                                                    "w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors",
                                                    selectedSC?.service_center_id === sc.service_center_id && "bg-emerald-50 border-l-4 border-emerald-500"
                                                )}
                                            >
                                                <div className={cn(
                                                    "h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0",
                                                    selectedSC?.service_center_id === sc.service_center_id
                                                        ? "bg-emerald-500 text-white"
                                                        : "bg-emerald-100 text-emerald-700"
                                                )}>
                                                    {sc.center_name.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={cn(
                                                        "font-medium truncate",
                                                        selectedSC?.service_center_id === sc.service_center_id && "text-emerald-700"
                                                    )}>
                                                        {sc.center_name}
                                                    </p>
                                                    {sc.center_code && (
                                                        <p className="text-xs text-muted-foreground">
                                                            Code: {sc.center_code}
                                                        </p>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* SC Chat Area */}
                        <div className="lg:col-span-2">
                            {selectedSC ? (
                                <FlexibleChat
                                    clientId="0" // SC-level chat (not client-specific)
                                    serviceCenterName={selectedSC.center_name}
                                    currentUserRole="ADMIN"
                                    recipients={[
                                        { role: "SERVICE_CENTER", label: selectedSC.center_name, color: "bg-emerald-500" },
                                    ]}
                                    height="550px"
                                />
                            ) : (
                                <Card className="h-[550px] flex items-center justify-center">
                                    <div className="text-center space-y-3 opacity-50">
                                        <div className="bg-emerald-100 p-4 rounded-full inline-block">
                                            <Building2 className="size-8 text-emerald-500" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-900">Select a service center to chat</p>
                                            <p className="text-sm text-slate-500">Choose from the list on the left</p>
                                        </div>
                                    </div>
                                </Card>
                            )}
                        </div>
                    </div>
                </TabsContent>

                {/* CPAs TAB */}
                <TabsContent value="cpas" className="mt-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* CPA List */}
                        <Card className="lg:col-span-1">
                            <CardHeader className="pb-3 border-b">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Landmark className="h-4 w-4 text-amber-600" />
                                    CPAs ({cpas.length})
                                </CardTitle>
                                <div className="relative mt-3">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search CPAs..."
                                        value={cpaSearch}
                                        onChange={(e) => setCPASearch(e.target.value)}
                                        className="pl-9"
                                    />
                                </div>
                            </CardHeader>
                            <CardContent className="p-0 max-h-[450px] overflow-y-auto">
                                {cpaLoading ? (
                                    <div className="p-4 text-sm text-muted-foreground text-center">Loading...</div>
                                ) : filteredCPAs.length === 0 ? (
                                    <div className="p-4 text-sm text-muted-foreground text-center">No CPAs found</div>
                                ) : (
                                    <div className="divide-y">
                                        {filteredCPAs.map((cpa) => (
                                            <button
                                                key={cpa.cpa_id}
                                                onClick={() => setSelectedCPA(cpa)}
                                                className={cn(
                                                    "w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors",
                                                    selectedCPA?.cpa_id === cpa.cpa_id && "bg-amber-50 border-l-4 border-amber-500"
                                                )}
                                            >
                                                <div className={cn(
                                                    "h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0",
                                                    selectedCPA?.cpa_id === cpa.cpa_id
                                                        ? "bg-amber-500 text-white"
                                                        : "bg-amber-100 text-amber-700"
                                                )}>
                                                    {cpa.cpa_name.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={cn(
                                                        "font-medium truncate",
                                                        selectedCPA?.cpa_id === cpa.cpa_id && "text-amber-700"
                                                    )}>
                                                        {cpa.cpa_name}
                                                    </p>
                                                    {cpa.email && (
                                                        <p className="text-xs text-muted-foreground truncate">
                                                            {cpa.email}
                                                        </p>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* CPA Chat Area */}
                        <div className="lg:col-span-2">
                            {selectedCPA ? (
                                <FlexibleChat
                                    clientId="0" // CPA-level chat (not client-specific)
                                    currentUserRole="ADMIN"
                                    recipients={[
                                        { role: "CPA", label: selectedCPA.cpa_name, color: "bg-amber-500" },
                                    ]}
                                    height="550px"
                                />
                            ) : (
                                <Card className="h-[550px] flex items-center justify-center">
                                    <div className="text-center space-y-3 opacity-50">
                                        <div className="bg-amber-100 p-4 rounded-full inline-block">
                                            <Landmark className="size-8 text-amber-500" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-900">Select a CPA to chat</p>
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
