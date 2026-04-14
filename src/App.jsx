import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth'
import AppLayout from '@/components/layout/AppLayout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Leads from '@/pages/Leads'
import LeadDetail from '@/pages/LeadDetail'
import Pipeline from '@/pages/Pipeline'
import Quotes from '@/pages/Quotes'
import { Reports, Calendar } from '@/pages/Placeholders'
import Settings from '@/pages/Settings'
import Contacts from '@/pages/Contacts'
import Orders from '@/pages/Orders'
import Catalog from '@/pages/Catalog'
import Profitability from '@/pages/Profitability'
import NewQuote from '@/pages/NewQuote'
import PriceLists from '@/pages/PriceLists'
import CatalogMatch from '@/pages/CatalogMatch'
import Families from '@/pages/Families'
import CatalogNormalize from '@/pages/CatalogNormalize'
import OemCodes from '@/pages/OemCodes'
import Workshops from '@/pages/Workshops'
import AttentionPanel from '@/pages/AttentionPanel'
import WorkshopNew from '@/pages/WorkshopNew'
import TireAnalyzer from '@/pages/TireAnalyzer'
import DeliveryRules from '@/pages/DeliveryRules'
import DeliveryServices from '@/pages/DeliveryServices'
import CompetitorPrices from '@/pages/CompetitorPrices'
import InventorySources from '@/pages/InventorySources'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
    }
  }
})

function ProtectedRoute({ children }) {
  const { token } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/" element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="leads" element={<Leads />} />
            <Route path="leads/:id" element={<LeadDetail />} />
            <Route path="pipeline" element={<Pipeline />} />
            <Route path="quotes" element={<Quotes />} />
            <Route path="quotes/new" element={<NewQuote />} />
            <Route path="price-lists" element={<PriceLists />} />
            <Route path="catalog-match" element={<CatalogMatch />} />
            <Route path="families" element={<Families />} />
            <Route path="catalog-normalize" element={<CatalogNormalize />} />
            <Route path="oem-codes" element={<OemCodes />} />
            <Route path="workshops" element={<Workshops />} />
            <Route path="workshops/new" element={<WorkshopNew />} />
            <Route path="attention" element={<AttentionPanel />} />
            <Route path="workshops/:id/edit" element={<WorkshopNew />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="reports" element={<Reports />} />
            <Route path="contacts" element={<Contacts />} />
            <Route path="orders" element={<Orders />} />
            <Route path="catalog" element={<Catalog />} />
            <Route path="profitability" element={<Profitability />} />
            <Route path="settings" element={<Settings />} />
            <Route path="tire-analyzer" element={<TireAnalyzer />} />
            <Route path="delivery-rules" element={<DeliveryRules />} />
            <Route path="delivery-services" element={<DeliveryServices />} />
            <Route path="business-rules" element={<DeliveryRules />} />
            <Route path="competitor-prices" element={<CompetitorPrices />} />
            <Route path="inventory-sources" element={<InventorySources />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
