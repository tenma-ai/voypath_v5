'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Send, Check, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMemberColorContext } from '@/lib/utils/member-colors';
import { ScrollableArea } from '@/components/layout/responsive-layout';

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

interface MessageRead {
  id: string;
  message_id: string;
  user_id: string | null;
  session_id: string | null;
  display_name: string;
  read_at: string;
}

interface TripMember {
  id: string;
  user_id: string | null;
  session_id: string | null;
  display_name: string;
  role: string;
  joined_at: string;
}

interface EnhancedChatProps {
  tripId: string;
  currentUserId: string | null;
  currentSessionId: string;
  currentUserName: string;
}

export function EnhancedChat({
  tripId,
  currentUserId,
  currentSessionId,
  currentUserName
}: EnhancedChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageReads, setMessageReads] = useState<Record<string, MessageRead[]>>({});
  const [tripMembers, setTripMembers] = useState<TripMember[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  
  // メンバーカラーコンテキスト
  const { getMemberColorByKey } = useMemberColorContext(
    tripMembers,
    currentUserId,
    currentSessionId
  );
  
  // メッセージ取得
  useEffect(() => {
    fetchInitialData();
    
    // リアルタイム購読
    const messagesChannel = supabase
      .channel(`messages:${tripId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `trip_id=eq.${tripId}`
      }, (payload) => {
        const newMsg = payload.new as ChatMessage;
        setMessages(prev => [...prev, newMsg]);
        // 自分以外のメッセージの場合、既読をマーク
        if (newMsg.user_id !== currentUserId && newMsg.session_id !== currentSessionId) {
          markMessageAsRead(newMsg.id);
        }
      })
      .subscribe();
    
    const readsChannel = supabase
      .channel(`reads:${tripId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'message_reads',
        filter: `trip_id=eq.${tripId}`
      }, (payload) => {
        const newRead = payload.new as MessageRead;
        setMessageReads(prev => ({
          ...prev,
          [newRead.message_id]: [...(prev[newRead.message_id] || []), newRead]
        }));
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(readsChannel);
    };
  }, [tripId]);
  
  // 初期データ取得
  const fetchInitialData = async () => {
    setIsLoading(true);
    
    try {
      // メンバー取得
      const { data: members } = await supabase
        .from('trip_members')
        .select('*')
        .eq('trip_id', tripId)
        .order('joined_at');
      
      if (members) {
        setTripMembers(members);
      }
      
      // メッセージ取得
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at');
      
      if (msgs) {
        setMessages(msgs);
        
        // 既読情報取得
        const messageIds = msgs.map(m => m.id);
        const { data: reads } = await supabase
          .from('message_reads')
          .select('*')
          .in('message_id', messageIds);
        
        if (reads) {
          const readsByMessage: Record<string, MessageRead[]> = {};
          reads.forEach(read => {
            if (!readsByMessage[read.message_id]) {
              readsByMessage[read.message_id] = [];
            }
            readsByMessage[read.message_id].push(read);
          });
          setMessageReads(readsByMessage);
        }
        
        // 未読メッセージを既読にマーク
        const unreadMessages = msgs.filter(msg => 
          msg.user_id !== currentUserId && 
          msg.session_id !== currentSessionId &&
          !reads?.some(r => 
            r.message_id === msg.id &&
            ((r.user_id && r.user_id === currentUserId) ||
             (!r.user_id && r.session_id === currentSessionId))
          )
        );
        
        for (const msg of unreadMessages) {
          await markMessageAsRead(msg.id);
        }
      }
    } catch (error) {
      console.error('Error fetching chat data:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // メッセージを既読にマーク
  const markMessageAsRead = async (messageId: string) => {
    try {
      await supabase
        .from('message_reads')
        .insert({
          message_id: messageId,
          trip_id: tripId,
          user_id: currentUserId,
          session_id: currentSessionId,
          display_name: currentUserName,
          read_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };
  
  // メッセージ送信
  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || isSending) return;
    
    setIsSending(true);
    
    try {
      await supabase
        .from('messages')
        .insert({
          trip_id: tripId,
          user_id: currentUserId,
          session_id: currentSessionId,
          display_name: currentUserName,
          message_text: newMessage.trim(),
          message_type: 'text'
        });
      
      setNewMessage('');
      
      // スクロール
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };
  
  // 既読アイコンを取得
  const getReadReceipts = (message: ChatMessage) => {
    const reads = messageReads[message.id] || [];
    // 送信者以外の既読者
    const otherReads = reads.filter(read => 
      (message.user_id && read.user_id !== message.user_id) ||
      (message.session_id && read.session_id !== message.session_id)
    );
    
    return otherReads;
  };
  
  // 自分のメッセージかどうか
  const isMyMessage = (message: ChatMessage) => {
    return (currentUserId && message.user_id === currentUserId) ||
           (!currentUserId && message.session_id === currentSessionId);
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* メッセージエリア */}
      <ScrollableArea height="calc(100vh - 200px)" className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => {
            const isMe = isMyMessage(message);
            const memberColor = getMemberColorByKey(message.user_id, message.session_id);
            const readReceipts = getReadReceipts(message);
            
            return (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  isMe && "flex-row-reverse"
                )}
              >
                {/* アバター */}
                {!isMe && (
                  <Avatar className="h-8 w-8">
                    <AvatarFallback
                      style={{
                        backgroundColor: memberColor?.color ? `${memberColor.color}20` : '#E5E7EB',
                        color: memberColor?.color || '#6B7280'
                      }}
                    >
                      {message.display_name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
                
                {/* メッセージ本体 */}
                <div className={cn(
                  "max-w-[70%] space-y-1",
                  isMe && "items-end"
                )}>
                  {/* 名前と時刻 */}
                  {!isMe && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium">{message.display_name}</span>
                      <span>
                        {new Date(message.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  )}
                  
                  {/* メッセージ */}
                  <div
                    className={cn(
                      "rounded-lg px-4 py-2",
                      isMe 
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {message.message_text}
                    </p>
                  </div>
                  
                  {/* 既読表示（自分のメッセージのみ） */}
                  {isMe && (
                    <div className="flex items-center gap-1 justify-end">
                      {readReceipts.length === 0 ? (
                        <Check className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <>
                          <CheckCheck className="h-3 w-3 text-primary" />
                          <div className="flex -space-x-2">
                            {readReceipts.slice(0, 3).map((read, idx) => {
                              const readerColor = getMemberColorByKey(read.user_id, read.session_id);
                              return (
                                <Avatar key={idx} className="h-4 w-4 border border-background">
                                  <AvatarFallback
                                    className="text-[8px]"
                                    style={{
                                      backgroundColor: readerColor?.color || '#E5E7EB',
                                      color: 'white'
                                    }}
                                  >
                                    {read.display_name[0]}
                                  </AvatarFallback>
                                </Avatar>
                              );
                            })}
                            {readReceipts.length > 3 && (
                              <span className="text-[10px] text-muted-foreground ml-1">
                                +{readReceipts.length - 3}
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  
                  {/* 時刻（自分のメッセージ） */}
                  {isMe && (
                    <div className="text-xs text-muted-foreground text-right">
                      {new Date(message.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </ScrollableArea>
      
      {/* 入力エリア */}
      <form onSubmit={handleSendMessage} className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="メッセージを入力..."
            disabled={isSending}
            className="flex-1"
          />
          <Button 
            type="submit" 
            disabled={!newMessage.trim() || isSending}
            size="icon"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}