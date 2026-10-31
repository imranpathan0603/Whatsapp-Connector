import React, { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar.jsx";
import { ALL_NAV_ITEMS } from "./navigation.js";
import Header from "./components/Header.jsx";
import useConnection from "./hooks/useConnection.js";
import useAIAssistant from "./hooks/useAIAssistant.js";
import FloatingAIButton from "./components/FloatingAIButton.jsx";
import AIChatWindow from "./components/AIChatWindow.jsx";

// Standard Pages
import Overview from "./pages/Overview.jsx";
import Connection from "./pages/Connection.jsx";
import Messages from "./pages/Messages.jsx";
import Chats from "./pages/Chats.jsx";
import Contacts from "./pages/Contacts.jsx";
import Groups from "./pages/Groups.jsx";
import Media from "./pages/Media.jsx";
import Links from "./pages/Links.jsx";
import SearchPage from "./pages/Search.jsx";
import Analytics from "./pages/Analytics.jsx";
import ConnectorSettings from "./pages/ConnectorSettings.jsx";

// Dedicated AI Pages
import AISummary from "./pages/AISummary.jsx";
import AIAnalytics from "./pages/AIAnalytics.jsx";
import AISettings from "./pages/AISettings.jsx";

import "./App.css";

export function App() {
  const [currentPage, setCurrentPage] = useState("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Global connection state hook with SSE real-time events
  const connectionState = useConnection();

  // Floating AI Assistant Copilot hook
  const assistant = useAIAssistant({ page: currentPage });

  // Keep assistant page context synchronized with active navigation
  useEffect(() => {
    assistant.setPageContext((prev) => ({
      ...prev,
      page: currentPage,
    }));
  }, [currentPage, assistant.setPageContext]);

  const handleGlobalRefresh = () => {
    connectionState.refreshStatus();
    setRefreshKey((prev) => prev + 1);
  };

  const handleOpenCopilot = (promptText = null) => {
    assistant.openAssistant(promptText);
  };

  const currentNav =
    ALL_NAV_ITEMS.find((item) => item.id === currentPage) || ALL_NAV_ITEMS[0];

  const renderActivePage = () => {
    switch (currentPage) {
      case "overview":
        return (
          <Overview
            key={refreshKey}
            connectionState={connectionState}
            onNavigate={setCurrentPage}
            onOpenCopilot={handleOpenCopilot}
          />
        );
      case "connection":
        return (
          <Connection
            key={refreshKey}
            connectionState={connectionState}
            onNavigate={setCurrentPage}
          />
        );
      case "messages":
        return <Messages key={refreshKey} onOpenCopilot={handleOpenCopilot} />;
      case "chats":
        return <Chats key={refreshKey} onOpenCopilot={handleOpenCopilot} />;
      case "contacts":
        return <Contacts key={refreshKey} onOpenCopilot={handleOpenCopilot} />;
      case "groups":
        return <Groups key={refreshKey} onOpenCopilot={handleOpenCopilot} />;
      case "media":
        return <Media key={refreshKey} />;
      case "links":
        return <Links key={refreshKey} />;
      case "search":
        return <SearchPage key={refreshKey} onOpenCopilot={handleOpenCopilot} />;
      case "analytics":
        return <Analytics key={refreshKey} onOpenCopilot={handleOpenCopilot} />;
      case "settings":
        return <ConnectorSettings key={refreshKey} />;
      case "ai-summary":
        return <AISummary key={refreshKey} onOpenCopilot={handleOpenCopilot} />;
      case "ai-analytics":
        return <AIAnalytics key={refreshKey} onOpenCopilot={handleOpenCopilot} />;
      case "ai-settings":
        return <AISettings key={refreshKey} onOpenCopilot={handleOpenCopilot} />;
      default:
        return (
          <Overview
            key={refreshKey}
            connectionState={connectionState}
            onNavigate={setCurrentPage}
            onOpenCopilot={handleOpenCopilot}
          />
        );
    }
  };

  return (
    <div className="app-shell-root">
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        connectionStatus={connectionState.status}
      />

      <div className="app-main-viewport">
        <Header
          title={currentNav.label}
          breadcrumb="Workspace"
          onOpenMenu={() => setMobileMenuOpen(true)}
          connectionStatus={connectionState.status}
          onRefresh={handleGlobalRefresh}
          refreshing={connectionState.loading}
          onNavigate={setCurrentPage}
        />

        <main className="app-page-content" role="main">
          {renderActivePage()}
        </main>
      </div>

      {/* Floating AI Button (Visible across all pages) */}
      <FloatingAIButton
        isOpen={assistant.isOpen}
        isMinimized={assistant.isMinimized}
        onClick={assistant.toggleOpen}
        unreadCount={assistant.unreadCount}
      />

      {/* Floating AI Chat Assistant Window */}
      <AIChatWindow
        isOpen={assistant.isOpen}
        isMinimized={assistant.isMinimized}
        onClose={assistant.close}
        onMinimize={assistant.minimize}
        onRestore={assistant.restore}
        messages={assistant.messages}
        loading={assistant.loading}
        error={assistant.error}
        onSendMessage={assistant.sendMessage}
        onClearChat={assistant.clearChat}
        pageContext={assistant.pageContext}
        onNavigatePage={setCurrentPage}
      />
    </div>
  );
}

export default App;
