'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useTrip } from '@/lib/contexts/trip-context';
import { createClient } from '@/lib/supabase/client';
import { useGuestStore } from '@/lib/stores/guest-store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { NoTripSelected } from '@/components/ui/no-trip-selected';

interface ChatMessage {
  id: string;
  group_id: string;
  user_id: string | null;
  session_id: string | null;
  display_name: string;
  message_text: string;
  message_type: string;
  created_at: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const { activeTrip, navigateWithTrip } = useTrip();
  const { sessionId, guestData } = useGuestStore();
  const router = useRouter();

  useEffect(() => {
    if (!activeTrip) return;
    
    const fetchMessages = async () => {
      setIsLoading(true);
      const supabase = createClient();
      
      try {
        const { data, error } = await supabase
          .from('group_chat_messages')
          .select('*')
          .eq('group_id', activeTrip.id)
          .order('created_at', { ascending: true });
          
        if (error) {
          console.error('Error fetching messages:', error);
        } else {
          setMessages(data || []);
        }
      } catch (err) {
        console.error('Unexpected error:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchMessages();
    
    // リアルタイム購読をセットアップ
    const supabase = createClient();
    const channel = supabase
      .channel(`group_chat:${activeTrip.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'group_chat_messages',
        filter: `group_id=eq.${activeTrip.id}`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as ChatMessage]);
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTrip, sessionId]);
  
  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!activeTrip || !sessionId || !newMessage.trim()) return;
    
    const message = {
      group_id: activeTrip.id,
      user_id: null,
      session_id: sessionId,
      display_name: guestData?.displayInitials || 'Guest',
      message_text: newMessage.trim(),
      message_type: 'text'
    };
    
    const supabase = createClient();
    await supabase.from('group_chat_messages').insert(message);
    
    setNewMessage('');
  };
  
  const handleBackToTrip = () => {
    navigateWithTrip('/my-trip');
  };

  return (
    <div className="container pb-20 pt-4">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" onClick={handleBackToTrip}>
          ← Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Group Chat</h1>
          {activeTrip && (
            <p className="text-sm text-muted-foreground">Trip: {activeTrip.name}</p>
          )}
        </div>
      </div>
      
      {!activeTrip ? (
        <NoTripSelected 
          title="No trip selected for chat" 
          message="Please select, create, or join a trip to start chatting"
        />
      ) : isLoading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
        </div>
      ) : (
        <div className="flex flex-col h-[70vh]">
          <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
            {messages.length > 0 ? (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-sky-100 dark:bg-sky-900 flex items-center justify-center text-sky-600 dark:text-sky-400 font-medium flex-shrink-0">
                      {message.display_name.substring(0, 2)}
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm max-w-[85%]">
                      <div className="flex justify-between items-center mb-1">
                        <p className="font-medium text-sm">{message.display_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(message.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </p>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{message.message_text}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
              </div>
            )}
          </div>
          
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1"
            />
            <Button 
              type="submit" 
              disabled={!newMessage.trim()}
              className="bg-sky-500 hover:bg-sky-600"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </div>
  );
} 