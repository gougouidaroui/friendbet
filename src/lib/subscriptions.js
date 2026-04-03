import { supabase } from './supabase.js';

const activeChannels = new Map();

export function registerChannel(name, channel) {
  if (activeChannels.has(name)) {
    return activeChannels.get(name);
  }
  activeChannels.set(name, channel);
  return channel;
}

export function getOrCreate(name, channelFactory) {
  if (activeChannels.has(name)) {
    return activeChannels.get(name);
  }
  const channel = channelFactory();
  activeChannels.set(name, channel);
  return channel;
}

export function remove(name) {
  const channel = activeChannels.get(name);
  if (channel) {
    supabase.removeChannel(channel);
    activeChannels.delete(name);
  }
}

export function removeAll() {
  for (const channel of activeChannels.values()) {
    supabase.removeChannel(channel);
  }
  activeChannels.clear();
}

export function has(name) {
  return activeChannels.has(name);
}
