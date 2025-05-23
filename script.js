import { useState, useEffect } from 'react';
import { Button } from "/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "/components/ui/card";
import { Input } from "/components/ui/input";
import { Label } from "/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "/components/ui/avatar";

type UserProfile = {
  uid: string;
  email: string;
  name: string;
  isAdmin: boolean;
  abn?: string;
  gstRegistered?: boolean;
  bsb?: string;
  acc?: string;
  approved?: boolean;
  profileSetupComplete?: boolean;
  nextInvoiceNumber?: number;
  authorizedServiceCodes?: string[];
};

type Service = {
  id: string;
  code: string;
  description: string;
  categoryType: string;
  rates: Record<string, number>;
  travelCode?: string;
};

type GlobalSettings = {
  portalType: 'organization' | 'participant';
  organizationName: string;
  participantName: string;
  participantNdisNo: string;
  setupComplete: boolean;
  rateMultipliers: Record<string, number>;
};

export default function NDISPortal() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState('home');
  const [services, setServices] = useState<Service[]>([]);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({
    portalType: 'organization',
    organizationName: 'NDIS Support Portal',
    participantName: 'Participant Name',
    participantNdisNo: '000 000 000',
    setupComplete: false,
    rateMultipliers: {
      weekday: 1.0,
      evening: 1.1,
      night: 1.14,
      saturday: 1.41,
      sunday: 1.81,
      public: 2.22
    }
  });

  // Mock authentication functions - in a real app these would connect to Firebase
  const handleLogin = async (email: string, password: string) => {
    setLoading(true);
    setAuthError('');
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock user data
      const mockUser: UserProfile = {
        uid: 'mock-user-123',
        email,
        name: email.split('@')[0],
        isAdmin: email === 'admin@example.com',
        approved: true,
        profileSetupComplete: true
      };
      
      setCurrentUser(mockUser);
      setActiveTab(mockUser.isAdmin ? 'admin' : 'home');
    } catch (error) {
      setAuthError('Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('home');
  };

  // Load initial data
  useEffect(() => {
    if (currentUser) {
      // Simulate loading services
      const mockServices: Service[] = [
        {
          id: '1',
          code: '01_123_4567_1_1',
          description: 'Core - Assistance with Daily Life',
          categoryType: 'core_standard',
          rates: { weekday: 55.75, evening: 61.33, night: 63.56, saturday: 78.61, sunday: 100.91, public: 123.77 }
        },
        {
          id: '2',
          code: '04_123_4567_1_1',
          description: 'Capacity Building - Therapy',
          categoryType: 'capacity_therapy_std',
          rates: { standardRate: 193.99 }
        }
      ];
      
      setServices(mockServices);
    }
  }, [currentUser]);

  // Render authentication screen if not logged in
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">NDIS Portal Login</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="your@email.com" />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" placeholder="••••••••" />
              </div>
              {authError && <p className="text-red-500 text-sm">{authError}</p>}
              <Button 
                className="w-full" 
                onClick={() => handleLogin('user@example.com', 'password')}
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main portal interface
  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-md">
        <div className="p-4 border-b">
          <div className="flex items-center space-x-3">
            <Avatar>
              <AvatarImage src="" />
              <AvatarFallback>{currentUser.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{currentUser.name}</p>
              <p className="text-sm text-gray-500">{currentUser.email}</p>
            </div>
          </div>
        </div>
        
        <nav className="p-2 space-y-1">
          <Button 
            variant={activeTab === 'home' ? 'secondary' : 'ghost'} 
            className="w-full justify-start"
            onClick={() => setActiveTab('home')}
          >
            Home
          </Button>
          <Button 
            variant={activeTab === 'invoice' ? 'secondary' : 'ghost'} 
            className="w-full justify-start"
            onClick={() => setActiveTab('invoice')}
          >
            Invoices
          </Button>
          <Button 
            variant={activeTab === 'agreement' ? 'secondary' : 'ghost'} 
            className="w-full justify-start"
            onClick={() => setActiveTab('agreement')}
          >
            Agreement
          </Button>
          {currentUser.isAdmin && (
            <Button 
              variant={activeTab === 'admin' ? 'secondary' : 'ghost'} 
              className="w-full justify-start"
              onClick={() => setActiveTab('admin')}
            >
              Admin
            </Button>
          )}
          <Button 
            variant="ghost" 
            className="w-full justify-start text-red-500 hover:text-red-600 mt-4"
            onClick={handleLogout}
          >
            Logout
          </Button>
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 p-8">
        {activeTab === 'home' && (
          <Card>
            <CardHeader>
              <CardTitle>Welcome, {currentUser.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                {currentUser.isAdmin 
                  ? 'You have administrator access to manage the portal.'
                  : 'View your upcoming shifts and invoices.'}
              </p>
            </CardContent>
          </Card>
        )}

        {activeTab === 'invoice' && (
          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap">2023-10-15</td>
                      <td className="px-6 py-4 whitespace-nowrap">Core Support</td>
                      <td className="px-6 py-4 whitespace-nowrap">4.00</td>
                      <td className="px-6 py-4 whitespace-nowrap">$223.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <Button className="mt-4">Create New Invoice</Button>
            </CardContent>
          </Card>
        )}

        {activeTab === 'admin' && currentUser.isAdmin && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Admin Dashboard</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="font-medium text-blue-800">Active Workers</h3>
                    <p className="text-2xl font-bold">12</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h3 className="font-medium text-green-800">Pending Approvals</h3>
                    <p className="text-2xl font-bold">3</p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <h3 className="font-medium text-purple-800">Services</h3>
                    <p className="text-2xl font-bold">{services.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Manage Services</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {services.map(service => (
                        <tr key={service.id}>
                          <td className="px-6 py-4 whitespace-nowrap">{service.code}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{service.description}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            ${service.rates.weekday || service.rates.standardRate?.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Button variant="ghost" size="sm" className="mr-2">Edit</Button>
                            <Button variant="ghost" size="sm" className="text-red-500">Delete</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button className="mt-4">Add New Service</Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
