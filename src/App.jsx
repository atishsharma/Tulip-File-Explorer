import { useState, useEffect, useCallback } from 'react';
import TitleBar from './components/TitleBar/TitleBar';
import Sidebar from './components/Sidebar/Sidebar';
import FileExplorer from './components/FileExplorer/FileExplorer';
import PreviewPanel from './components/PreviewPanel/PreviewPanel';
import SettingsModal from './components/SettingsModal/SettingsModal';
import PropertiesModal from './components/PropertiesModal/PropertiesModal';
import RcloneModal from './components/RcloneModal/RcloneModal';
import Toasts from './components/Toasts/Toasts';
import { useTheme } from './hooks/useTheme';
import { useFileSystem } from './hooks/useFileSystem';
import { useToasts } from './hooks/useToasts';
import { readStorage, writeStorage } from './utils/storage';
import './App.css';

const COLORS = ['blue', 'purple', 'pink', 'red', 'orange', 'green', 'teal', 'indigo'];

function App() {
  const { theme, setTheme } = useTheme();
  const { toasts, notify, dismiss } = useToasts();
  // Preview panel hidden by default on first open
  const [showPreview, setShowPreview] = useState(() => readStorage('tulip-show-preview', false) === true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showProperties, setShowProperties] = useState(false);
  const [showRcloneModal, setShowRcloneModal] = useState(false);
  const [propertiesItem, setPropertiesItem] = useState(null);
  const [clipboardStatus, setClipboardStatus] = useState(null);
  const [appVersion, setAppVersion] = useState('');
  const [primaryColor, setPrimaryColor] = useState(() => {
    const saved = readStorage('tulip-color', 'blue');
    return COLORS.includes(saved) ? saved : 'blue';
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
    deleteItems,
    renameItem,
    createFolder,
    createFile,
    showContextMenu,
    pasteFromClipboard,
  } = useFileSystem({ notify });

  // Apply color to document
  useEffect(() => {
    document.documentElement.setAttribute('data-color', primaryColor);
    writeStorage('tulip-color', primaryColor);
  }, [primaryColor]);

  // Search state, cleared whenever the folder changes
  const [searchQuery, setSearchQuery] = useState('');
  const [searchPath, setSearchPath] = useState(currentPath);
  if (searchPath !== currentPath) {
    setSearchPath(currentPath);
    setSearchQuery('');
  }

  useEffect(() => {
    writeStorage('tulip-show-preview', showPreview);
  }, [showPreview]);

  // Clipboard state is pushed from the main process whenever it changes
  useEffect(() => {
    if (!window.electronAPI) return undefined;
    window.electronAPI.clipboardGetStatus().then(setClipboardStatus);
    window.electronAPI.getAppVersion().then(setAppVersion).catch(() => {});
    return window.electronAPI.onClipboardChanged(setClipboardStatus);
  }, []);

  const handleShowProperties = useCallback((item) => {
    setPropertiesItem(item);
    setShowProperties(true);
  }, []);

  const handleZipFile = useCallback(async (item) => {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.zipFile(item.path);
    if (result.success) {
      notify(`Created ${result.zipPath.split(/[\\/]/).pop()}`, 'success');
      refresh({ silent: true });
    } else {
      notify(`Failed to create zip: ${result.error}`, 'error');
    }
  }, [notify, refresh]);

  const handleUnmount = useCallback(async (drive) => {
    const result = await window.electronAPI?.rclone.unmount(drive.name);
    if (result && !result.success) {
      notify(`Failed to unmount ${drive.name}: ${result.error}`, 'error');
    } else {
      refresh({ silent: true });
    }
  }, [notify, refresh]);

  // Shared context menu handler: generic actions are handled here, the rest returned to the caller
  const handleContextMenuAction = useCallback(async (menuType, item) => {
    if (!window.electronAPI) return null;

    const action = await showContextMenu(menuType, item);

    if (action === 'properties') {
      handleShowProperties(item || { name: currentPath, path: currentPath, isDirectory: true });
      return null;
    }
    if (action === 'zip' && item) {
      await handleZipFile(item);
      return null;
    }
    if (action === 'unmount' && item) {
      await handleUnmount(item);
      return null;
    }
    return action;
  }, [showContextMenu, handleShowProperties, handleZipFile, handleUnmount, currentPath]);

  const modalOpen = showSettings || showProperties || showRcloneModal;

  return (
    <div className="app" data-theme={theme} data-color={primaryColor}>
      <TitleBar
        showPreview={showPreview}
        onTogglePreview={() => setShowPreview((prev) => !prev)}
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
        />
        <FileExplorer
          currentPath={currentPath}
          items={items}
          searchQuery={searchQuery}
          onSearch={setSearchQuery}
          specialFolders={specialFolders}
          cloudDrives={cloudDrives}
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
          onPaste={pasteFromClipboard}
          onRefresh={refresh}
          onDeleteItems={deleteItems}
          onRenameItem={renameItem}
          onCreateFolder={createFolder}
          onCreateFile={createFile}
          onShowContextMenu={handleContextMenuAction}
          onSelectItem={setSelectedItem}
          onShowProperties={handleShowProperties}
          clipboardStatus={clipboardStatus}
          shortcutsEnabled={!modalOpen}
        />
        {showPreview && (
          <PreviewPanel item={selectedItem} />
        )}
      </div>

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        currentColor={primaryColor}
        onColorChange={setPrimaryColor}
        theme={theme}
        onThemeChange={setTheme}
        version={appVersion}
      />

      {showProperties && propertiesItem && (
        <PropertiesModal
          key={propertiesItem.path}
          isOpen
          onClose={() => setShowProperties(false)}
          item={propertiesItem}
          onRename={renameItem}
          onChanged={() => refresh({ silent: true })}
          notify={notify}
        />
      )}

      <RcloneModal
        isOpen={showRcloneModal}
        onClose={() => setShowRcloneModal(false)}
        onMounted={() => refresh({ silent: true })}
        notify={notify}
      />

      <Toasts toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

export default App;
