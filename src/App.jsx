import { useState, useEffect } from 'react';
import TitleBar from './components/TitleBar/TitleBar';
import Sidebar from './components/Sidebar/Sidebar';
import FileExplorer from './components/FileExplorer/FileExplorer';
import PreviewPanel from './components/PreviewPanel/PreviewPanel';
import SettingsModal from './components/SettingsModal/SettingsModal';
import PropertiesModal from './components/PropertiesModal/PropertiesModal';
import RcloneModal from './components/RcloneModal/RcloneModal';
import { useTheme } from './hooks/useTheme';
import { useFileSystem } from './hooks/useFileSystem';
import './App.css';

function App() {
  const { theme, setTheme, toggleTheme } = useTheme();
  // Preview panel hidden by default on first open
  const [showPreview, setShowPreview] = useState(() => {
    const saved = localStorage.getItem('tulip-show-preview');
    return saved ? JSON.parse(saved) : false;
  });
  const [selectedItem, setSelectedItem] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showProperties, setShowProperties] = useState(false);
  const [showRcloneModal, setShowRcloneModal] = useState(false);
  const [propertiesItem, setPropertiesItem] = useState(null);
  const [clipboardStatus, setClipboardStatus] = useState(null);
  const [primaryColor, setPrimaryColor] = useState(() => {
    return localStorage.getItem('tulip-color') || 'blue';
  });

  const {
    currentPath,
    items,
    loading,
    error,
    specialFolders,
    drives,
    cloudDrives,
    navigateTo,
    navigateBack,
    navigateForward,
    navigateUp,
    canGoBack,
    canGoForward,
    canGoUp,
    openFile,
    refresh,
    deleteItem,
    deleteItems,
    renameItem,
    createFolder,
    createFile,
    showContextMenu,
    pasteFromClipboard,
    openWith,
  } = useFileSystem();

  // Apply color to document
  useEffect(() => {
    document.documentElement.setAttribute('data-color', primaryColor);
    localStorage.setItem('tulip-color', primaryColor);
  }, [primaryColor]);

  // Save preview panel state
  useEffect(() => {
    localStorage.setItem('tulip-show-preview', JSON.stringify(showPreview));
  }, [showPreview]);

  // Update clipboard status periodically
  useEffect(() => {
    async function updateClipboard() {
      if (window.electronAPI) {
        const status = await window.electronAPI.clipboardGetStatus();
        setClipboardStatus(status);
      }
    }
    updateClipboard();
    const interval = setInterval(updateClipboard, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleTogglePreview = () => {
    setShowPreview((prev) => !prev);
  };

  const handleSelectItem = (item) => {
    setSelectedItem(item);
  };

  const handleShowProperties = (item) => {
    setPropertiesItem(item);
    setShowProperties(true);
  };

  const handleZipFile = async (item) => {
    if (!window.electronAPI) return;

    const result = await window.electronAPI.zipFile(item.path);
    if (result.success) {
      refresh();
    } else {
      alert(`Failed to create zip: ${result.error}`);
    }
  };

  // Extended context menu handler
  const handleContextMenuAction = async (menuType, item) => {
    if (!window.electronAPI) return null;

    const action = await showContextMenu(menuType, item);

    if (action === 'properties') {
      handleShowProperties(item);
      return null;
    }

    if (action === 'zip' && item) {
      await handleZipFile(item);
      return null;
    }

    return action;
  };

  return (
    <div className="app" data-theme={theme} data-color={primaryColor}>
      <TitleBar
        showPreview={showPreview}
        onTogglePreview={handleTogglePreview}
        onOpenSettings={() => setShowSettings(true)}
      />
      <div className="app-content">
        <Sidebar
          specialFolders={specialFolders}
          drives={drives}
          cloudDrives={cloudDrives}
          currentPath={currentPath}
          onNavigate={navigateTo}
          onShowContextMenu={handleContextMenuAction}
          onAddCloudDrive={() => setShowRcloneModal(true)}
          onRefresh={refresh}
        />
        <FileExplorer
          currentPath={currentPath}
          items={items}
          loading={loading}
          error={error}
          onNavigate={navigateTo}
          onNavigateBack={navigateBack}
          onNavigateForward={navigateForward}
          onNavigateUp={navigateUp}
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          canGoUp={canGoUp}
          onOpenFile={openFile}
          onOpenWith={openWith}
          onPaste={pasteFromClipboard}
          onRefresh={refresh}
          onDeleteItem={deleteItem}
          onDeleteItems={deleteItems}
          onRenameItem={renameItem}
          onCreateFolder={createFolder}
          onCreateFile={createFile}
          onShowContextMenu={handleContextMenuAction}
          selectedItem={selectedItem}
          onSelectItem={handleSelectItem}
          onShowProperties={handleShowProperties}
          clipboardStatus={clipboardStatus}
        />
        {showPreview && (
          <PreviewPanel
            item={selectedItem}
            onClose={() => setShowPreview(false)}
          />
        )}
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        currentColor={primaryColor}
        onColorChange={setPrimaryColor}
        theme={theme}
        onThemeChange={setTheme}
      />

      {/* Properties Modal */}
      <PropertiesModal
        isOpen={showProperties}
        onClose={() => setShowProperties(false)}
        item={propertiesItem}
        onRename={renameItem}
      />

      {/* Rclone Modal */}
      <RcloneModal
        isOpen={showRcloneModal}
        onClose={() => setShowRcloneModal(false)}
        onMount={(remote, path) => {
          refresh(); // Refresh drive list/file explorer if needed
        }}
      />
    </div>
  );
}

export default App;
