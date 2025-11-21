/**
 * AI Model Selector Component
 * Allows users to switch between different AI models
 */

import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Brain, Zap, Crown, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  tier: 'free' | 'paid';
  speed: 'fast' | 'medium' | 'slow';
  quality: 'good' | 'better' | 'best';
  description: string;
}

export const AVAILABLE_MODELS: AIModel[] = [
  {
    id: 'meta-llama/llama-3.2-3b-instruct:free',
    name: 'Llama 3.2 3B',
    provider: 'Meta',
    tier: 'free',
    speed: 'fast',
    quality: 'good',
    description: 'Fast and efficient for most tasks. Good for basic accounting queries.'
  },
  {
    id: 'google/gemini-2.0-flash-exp:free',
    name: 'Gemini 2.0 Flash',
    provider: 'Google',
    tier: 'free',
    speed: 'fast',
    quality: 'better',
    description: 'Great balance of speed and quality. Can get rate-limited during peak times.'
  },
  {
    id: 'google/gemma-2-9b-it:free',
    name: 'Gemma 2 9B',
    provider: 'Google',
    tier: 'free',
    speed: 'medium',
    quality: 'better',
    description: 'More powerful, better for complex accounting scenarios.'
  },
  {
    id: 'mistralai/mistral-7b-instruct:free',
    name: 'Mistral 7B',
    provider: 'Mistral AI',
    tier: 'free',
    speed: 'medium',
    quality: 'good',
    description: 'Reliable and consistent. Good alternative when others are rate-limited.'
  },
  {
    id: 'nousresearch/hermes-3-llama-3.1-405b:free',
    name: 'Hermes 3 (405B)',
    provider: 'Nous Research',
    tier: 'free',
    speed: 'slow',
    quality: 'best',
    description: 'Most powerful free model. Best for complex financial analysis.'
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    tier: 'paid',
    speed: 'medium',
    quality: 'best',
    description: 'Premium model. Requires OpenRouter API key with credits.'
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    tier: 'paid',
    speed: 'medium',
    quality: 'best',
    description: 'Premium model. Requires OpenRouter API key with credits.'
  },
];

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
}

export function ModelSelector({ selectedModel, onModelChange }: ModelSelectorProps) {
  const currentModel = AVAILABLE_MODELS.find(m => m.id === selectedModel) || AVAILABLE_MODELS[0];

  const getSpeedIcon = (speed: string) => {
    if (speed === 'fast') return <Zap className="h-3 w-3 text-green-500" />;
    if (speed === 'medium') return <Zap className="h-3 w-3 text-yellow-500" />;
    return <Zap className="h-3 w-3 text-orange-500" />;
  };

  const getTierIcon = (tier: string) => {
    return tier === 'paid' ? <Crown className="h-3 w-3 text-amber-500" /> : null;
  };

  return (
    <div className="flex items-center gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedModel} onValueChange={onModelChange}>
                <SelectTrigger className="w-[200px] h-8 text-xs">
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      {getTierIcon(currentModel.tier)}
                      <span className="truncate">{currentModel.name}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-1 text-xs text-muted-foreground border-b mb-1">
                    Free Models
                  </div>
                  {AVAILABLE_MODELS.filter(m => m.tier === 'free').map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex items-center justify-between w-full gap-3">
                        <div className="flex flex-col items-start">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{model.name}</span>
                            {getSpeedIcon(model.speed)}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {model.provider}
                          </span>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                  
                  <div className="px-2 py-1 text-xs text-muted-foreground border-b border-t mt-1 mb-1">
                    Premium Models (Requires API Key)
                  </div>
                  {AVAILABLE_MODELS.filter(m => m.tier === 'paid').map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex items-center justify-between w-full gap-3">
                        <div className="flex flex-col items-start">
                          <div className="flex items-center gap-2">
                            <Crown className="h-3 w-3 text-amber-500" />
                            <span className="font-medium">{model.name}</span>
                            {getSpeedIcon(model.speed)}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {model.provider}
                          </span>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="text-xs">
              <p className="font-semibold mb-1">{currentModel.name}</p>
              <p className="text-muted-foreground">{currentModel.description}</p>
              <div className="flex items-center gap-2 mt-2 text-xs">
                <span className="flex items-center gap-1">
                  {getSpeedIcon(currentModel.speed)}
                  {currentModel.speed}
                </span>
                <span>•</span>
                <span>{currentModel.quality} quality</span>
                <span>•</span>
                <span>{currentModel.tier}</span>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Info className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-sm">
            <div className="text-xs space-y-2">
              <p className="font-semibold">About AI Models:</p>
              <p>
                <strong>Free models:</strong> Rate-limited during peak times. 
                Switch models if you get rate limit errors.
              </p>
              <p>
                <strong>Premium models:</strong> Require your own OpenRouter API key. 
                No rate limits, better quality.
              </p>
              <p className="text-muted-foreground">
                Get API key at: openrouter.ai
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}


