'use client';

import { useState, useEffect } from 'react';
import { RotateCcw, Save, Eye, EyeOff, Key, ImageIcon, Cpu, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { useChatStore } from '@/lib/store';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function PasswordInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <Input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pr-10 text-xs rounded-lg"
        style={{
          background: 'var(--ds-bg-tertiary)',
          border: '1px solid var(--ds-border)',
          color: 'var(--ds-text-primary)',
        }}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors"
        style={{ color: 'var(--ds-text-secondary)' }}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

export function Settings() {
  const settings = useChatStore((s) => s.settings);
  const settingsOpen = useChatStore((s) => s.settingsOpen);
  const toggleSettings = useChatStore((s) => s.toggleSettings);
  const updateSettings = useChatStore((s) => s.updateSettings);
  const saveSettings = useChatStore((s) => s.saveSettings);
  const resetSettings = useChatStore((s) => s.resetSettings);

  const [localSettings, setLocalSettings] = useState(settings);
  const [primaryConnected, setPrimaryConnected] = useState<boolean | null>(null);
  const [imageConnected, setImageConnected] = useState<boolean | null>(null);
  const [testingPrimary, setTestingPrimary] = useState(false);
  const [testingImage, setTestingImage] = useState(false);
  const [githubToken, setGithubToken] = useState('');
  const [githubConnected, setGithubConnected] = useState<boolean | null>(null);
  const [githubUser, setGithubUser] = useState<string | null>(null);
  const [testingGithub, setTestingGithub] = useState(false);

  // Sync from store when sheet opens
  useEffect(() => {
    if (settingsOpen) {
      const s = useChatStore.getState().settings;
      setLocalSettings(s);
      setGithubToken(s.githubToken || '');
      setGithubConnected(null);
      setGithubUser(null);
    }
  }, [settingsOpen]);

  const handleSave = () => {
    updateSettings({ ...localSettings, githubToken });
    saveSettings();
    toast.success('Settings saved');
  };

  const handleReset = () => {
    const defaults = {
      primaryApi: {
        apiKey: '',
        baseUrl: 'https://integrate.api.nvidia.com/v1',
        model: 'meta/llama-3.1-405b-instruct',
      },
      imageApi: {
        provider: 'nvidia',
        apiKey: '',
        baseUrl: 'https://integrate.api.nvidia.com/v1',
        model: 'stabilityai/stable-diffusion-xl',
      },
    };
    setLocalSettings(defaults);
    resetSettings();
    setPrimaryConnected(null);
    setImageConnected(null);
    toast.info('Settings reset to defaults');
  };

  const testConnection = async (type: 'primary' | 'image') => {
    const s = type === 'primary' ? localSettings.primaryApi : localSettings.imageApi;
    if (!s.apiKey) {
      toast.error('Please enter an API key first');
      return;
    }

    if (type === 'primary') {
      setTestingPrimary(true);
    } else {
      setTestingImage(true);
    }

    try {
      const baseUrl = s.baseUrl.replace(/\/$/, '');
      const testUrl = `${baseUrl}/models`;
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: { Authorization: `Bearer ${s.apiKey}` },
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        if (type === 'primary') {
          setPrimaryConnected(true);
          toast.success('Primary API connected successfully');
        } else {
          setImageConnected(true);
          toast.success('Image API connected successfully');
        }
      } else {
        if (type === 'primary') {
          setPrimaryConnected(false);
          toast.error(`Primary API returned ${response.status}`);
        } else {
          setImageConnected(false);
          toast.error(`Image API returned ${response.status}`);
        }
      }
    } catch {
      if (type === 'primary') {
        setPrimaryConnected(false);
        toast.error('Primary API connection failed');
      } else {
        setImageConnected(false);
        toast.error('Image API connection failed');
      }
    } finally {
      if (type === 'primary') {
        setTestingPrimary(false);
      } else {
        setTestingImage(false);
      }
    }
  };

  return (
    <Sheet open={settingsOpen} onOpenChange={toggleSettings}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-y-auto"
        style={{ background: 'var(--ds-bg-secondary)', borderLeft: '1px solid var(--ds-border)' }}
      >
        <SheetHeader className="space-y-1">
          <SheetTitle className="flex items-center gap-2" style={{ color: 'var(--ds-text-primary)' }}>
            <Key className="w-4 h-4" style={{ color: 'var(--ds-accent)' }} />
            Settings
          </SheetTitle>
          <SheetDescription style={{ color: 'var(--ds-text-secondary)' }}>
            Configure API settings for the AI agent
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-8">
          {/* Primary API Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4" style={{ color: 'var(--ds-accent)' }} />
                <h3 className="text-sm font-semibold" style={{ color: 'var(--ds-text-primary)' }}>
                  Primary API
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {primaryConnected !== null && (
                  <Badge
                    variant="outline"
                    className="text-[10px]"
                    style={{
                      borderColor: primaryConnected ? 'rgba(5,150,105,0.3)' : 'rgba(220,38,38,0.3)',
                      color: primaryConnected ? 'var(--ds-success)' : 'var(--ds-error)',
                      background: primaryConnected ? 'rgba(5,150,105,0.08)' : 'rgba(220,38,38,0.08)',
                    }}
                  >
                    {primaryConnected ? 'Connected' : 'Failed'}
                  </Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testConnection('primary')}
                  disabled={testingPrimary}
                  className="h-7 text-xs rounded-lg"
                  style={{ borderColor: 'var(--ds-border)', color: 'var(--ds-text-secondary)' }}
                >
                  {testingPrimary ? 'Testing...' : 'Test'}
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="primary-api-key" className="text-xs" style={{ color: 'var(--ds-text-secondary)' }}>
                  API Key
                </Label>
                <PasswordInput
                  value={localSettings.primaryApi.apiKey}
                  onChange={(v) =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      primaryApi: { ...prev.primaryApi, apiKey: v },
                    }))
                  }
                  placeholder="Enter your API key"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="primary-base-url" className="text-xs" style={{ color: 'var(--ds-text-secondary)' }}>
                  Base URL
                </Label>
                <Input
                  id="primary-base-url"
                  value={localSettings.primaryApi.baseUrl}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      primaryApi: {
                        ...prev.primaryApi,
                        baseUrl: e.target.value,
                      },
                    }))
                  }
                  placeholder="https://api.example.com/v1"
                  className="text-xs rounded-lg"
                  style={{
                    background: 'var(--ds-bg-tertiary)',
                    border: '1px solid var(--ds-border)',
                    color: 'var(--ds-text-primary)',
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="primary-model" className="text-xs" style={{ color: 'var(--ds-text-secondary)' }}>
                  Model Name
                </Label>
                <Input
                  id="primary-model"
                  value={localSettings.primaryApi.model}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      primaryApi: { ...prev.primaryApi, model: e.target.value },
                    }))
                  }
                  placeholder="model-name"
                  className="text-xs rounded-lg"
                  style={{
                    background: 'var(--ds-bg-tertiary)',
                    border: '1px solid var(--ds-border)',
                    color: 'var(--ds-text-primary)',
                  }}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Image API Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4" style={{ color: 'var(--ds-accent)' }} />
                <h3 className="text-sm font-semibold" style={{ color: 'var(--ds-text-primary)' }}>
                  Image Generation API
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {imageConnected !== null && (
                  <Badge
                    variant="outline"
                    className="text-[10px]"
                    style={{
                      borderColor: imageConnected ? 'rgba(5,150,105,0.3)' : 'rgba(220,38,38,0.3)',
                      color: imageConnected ? 'var(--ds-success)' : 'var(--ds-error)',
                      background: imageConnected ? 'rgba(5,150,105,0.08)' : 'rgba(220,38,38,0.08)',
                    }}
                  >
                    {imageConnected ? 'Connected' : 'Failed'}
                  </Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testConnection('image')}
                  disabled={testingImage}
                  className="h-7 text-xs rounded-lg"
                  style={{ borderColor: 'var(--ds-border)', color: 'var(--ds-text-secondary)' }}
                >
                  {testingImage ? 'Testing...' : 'Test'}
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="image-provider" className="text-xs" style={{ color: 'var(--ds-text-secondary)' }}>
                  Provider
                </Label>
                <Select
                  value={localSettings.imageApi.provider}
                  onValueChange={(v) =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      imageApi: { ...prev.imageApi, provider: v },
                    }))
                  }
                >
                  <SelectTrigger className="text-xs rounded-lg" style={{ background: 'var(--ds-bg-tertiary)', border: '1px solid var(--ds-border)', color: 'var(--ds-text-primary)' }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nvidia">NVIDIA</SelectItem>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="stability">Stability AI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="image-api-key" className="text-xs" style={{ color: 'var(--ds-text-secondary)' }}>
                  API Key
                </Label>
                <PasswordInput
                  value={localSettings.imageApi.apiKey}
                  onChange={(v) =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      imageApi: { ...prev.imageApi, apiKey: v },
                    }))
                  }
                  placeholder="Enter your image API key"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="image-base-url" className="text-xs" style={{ color: 'var(--ds-text-secondary)' }}>
                  Base URL
                </Label>
                <Input
                  id="image-base-url"
                  value={localSettings.imageApi.baseUrl}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      imageApi: {
                        ...prev.imageApi,
                        baseUrl: e.target.value,
                      },
                    }))
                  }
                  placeholder="https://api.example.com/v1"
                  className="text-xs rounded-lg"
                  style={{
                    background: 'var(--ds-bg-tertiary)',
                    border: '1px solid var(--ds-border)',
                    color: 'var(--ds-text-primary)',
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="image-model" className="text-xs" style={{ color: 'var(--ds-text-secondary)' }}>
                  Model Name
                </Label>
                <Input
                  id="image-model"
                  value={localSettings.imageApi.model}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      imageApi: { ...prev.imageApi, model: e.target.value },
                    }))
                  }
                  placeholder="model-name"
                  className="text-xs rounded-lg"
                  style={{
                    background: 'var(--ds-bg-tertiary)',
                    border: '1px solid var(--ds-border)',
                    color: 'var(--ds-text-primary)',
                  }}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* GitHub Integration Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Github className="w-4 h-4" style={{ color: 'var(--ds-text-primary)' }} />
                <h3 className="text-sm font-semibold" style={{ color: 'var(--ds-text-primary)' }}>
                  GitHub Integration
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {githubConnected !== null && (
                  <Badge
                    variant="outline"
                    className="text-[10px]"
                    style={{
                      borderColor: githubConnected ? 'rgba(5,150,105,0.3)' : 'rgba(220,38,38,0.3)',
                      color: githubConnected ? 'var(--ds-success)' : 'var(--ds-error)',
                      background: githubConnected ? 'rgba(5,150,105,0.08)' : 'rgba(220,38,38,0.08)',
                    }}
                  >
                    {githubConnected ? `@${githubUser}` : 'Failed'}
                  </Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (!githubToken) { toast.error('Please enter a GitHub token'); return; }
                    setTestingGithub(true);
                    try {
                      const res = await fetch('https://api.github.com/user', {
                        headers: { Authorization: `Bearer ${githubToken}` },
                        signal: AbortSignal.timeout(10000),
                      });
                      if (res.ok) {
                        const user = await res.json();
                        setGithubUser(user.login);
                        setGithubConnected(true);
                        toast.success(`Connected as @${user.login}`);
                      } else {
                        setGithubConnected(false);
                        setGithubUser(null);
                        toast.error('Invalid GitHub token');
                      }
                    } catch {
                      setGithubConnected(false);
                      setGithubUser(null);
                      toast.error('GitHub connection failed');
                    } finally {
                      setTestingGithub(false);
                    }
                  }}
                  disabled={testingGithub}
                  className="h-7 text-xs rounded-lg"
                  style={{ borderColor: 'var(--ds-border)', color: 'var(--ds-text-secondary)' }}
                >
                  {testingGithub ? 'Checking...' : 'Connect'}
                </Button>
              </div>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs" style={{ color: 'var(--ds-text-secondary)' }}>
                  Personal Access Token
                </Label>
                <PasswordInput value={githubToken} onChange={setGithubToken} placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" />
                <p className="text-[11px]" style={{ color: 'var(--ds-text-muted)' }}>
                  Create at: github.com/settings/tokens &rarr; New token &rarr; Select: repo, read:user
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-xs gap-1.5 rounded-lg"
              style={{ color: 'var(--ds-text-secondary)' }}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset to Defaults
            </Button>
            <Button
              onClick={handleSave}
              size="sm"
              className="text-xs gap-1.5 text-white rounded-lg"
              style={{ background: 'var(--ds-accent)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--ds-accent-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--ds-accent)'}
            >
              <Save className="w-3.5 h-3.5" />
              Save Settings
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
