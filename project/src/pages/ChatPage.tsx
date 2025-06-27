import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Paperclip, Smile, MapPin, Calendar, Image as ImageIcon, Heart, ThumbsUp, Laugh, MoreVertical, Check, CheckCheck, X, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabase';
import { MemberColorService, type RefinedColor } from '../services/MemberColorService';

interface ChatMessage {
  id: string;
  trip_id: string;
  user_id: string;
  content: string | null;
  message_type: 'text' | 'image' | 'system';
  image_url: string | null;
  image_metadata: any;
  reply_to_id: string | null;
  edited_at: string | null;
  created_at: string;
  updated_at: string;
  user: {
    id: string;
    name: string;
    avatar_url?: string;
  };
  reactions: MessageReaction[];
  reads: MessageRead[];
  reply_to?: ChatMessage;
  reply_to_message?: ChatMessage;
}

interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
  user: {
    id: string;
    name: string;
  };
}

interface MessageRead {
  id: string;
  message_id: string;
  user_id: string;
  read_at: string;
  user: {
    id: string;
    name: string;
  };
}


export function ChatPage() {
  const { currentTrip, user, memberColors } = useStore();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [showReadDetails, setShowReadDetails] = useState<string | null>(null);
  const [currentUserColor, setCurrentUserColor] = useState<RefinedColor | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const commonEmojis = ['❤️', '👍', '😂', '😮', '😢', '😡'];

  // メッセージ読み込み
  const loadMessages = useCallback(async () => {
    if (!currentTrip?.id) return;

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          *,
          user:users(id, name, avatar_url),
          reactions:message_reactions(
            id, emoji, user_id, created_at,
            user:users(id, name)
          ),
          reads:message_reads(
            id, user_id, read_at,
            user:users(id, name)
          )
        `)
        .eq('trip_id', currentTrip.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      setMessages(data || []);
      
      // 新しいメッセージを既読にする
      if (data && data.length > 0) {
        await markMessagesAsRead(data.map(m => m.id));
      }
    } catch (error) {
      console.error('❌ Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  }, [currentTrip?.id, user?.id]);

  // メッセージ送信（楽観的更新）
  const handleSendMessage = async () => {
    if (!message.trim() || !currentTrip?.id || !user?.id) return;

    const messageContent = message;
    
    // 楽観的更新：即座にUIを更新
    const optimisticMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      trip_id: currentTrip.id,
      user_id: user.id,
      content: messageContent,
      message_type: 'text',
      image_url: null,
      image_metadata: null,
      reply_to_id: null,
      edited_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user: {
        id: user.id,
        name: user.name || 'You',
        avatar_url: user.avatar_url
      },
      reactions: [],
      reads: []
    };

    // UIを即座に更新
    setMessage('');
    setMessages(prev => [...prev, optimisticMessage]);

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          trip_id: currentTrip.id,
          user_id: user.id,
          content: messageContent,
          message_type: 'text',
          reply_to_id: null
        })
        .select(`
          *,
          user:users(id, name, avatar_url),
          reactions:message_reactions(*),
          reads:message_reads(*)
        `)
        .single();

      if (error) throw error;

      // 成功時：楽観的メッセージを実際のデータで置き換え
      setMessages(prev => 
        prev.map(msg => 
          msg.id === optimisticMessage.id 
            ? { ...data, reactions: [], reads: [] }
            : msg
        )
      );
      
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      // エラー時：楽観的メッセージを削除し、入力を復元
      setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
      setMessage(messageContent);
    }
  };

  // 写真アップロード
  const handleImageUpload = async (file: File) => {
    if (!currentTrip?.id || !user?.id) return;

    setUploading(true);
    try {
      // ファイル名生成
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      // Supabase Storageにアップロード
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // 公開URLを取得
      const { data: { publicUrl } } = supabase.storage
        .from('chat-images')
        .getPublicUrl(fileName);

      // メッセージとして保存
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          trip_id: currentTrip.id,
          user_id: user.id,
          content: null,
          message_type: 'image',
          image_url: publicUrl,
          image_metadata: {
            original_name: file.name,
            size: file.size,
            type: file.type
          },
          reply_to_id: null
        })
        .select(`
          *,
          user:users(id, name, avatar_url),
          reactions:message_reactions(*),
          reads:message_reads(*)
        `)
        .single();

      if (error) throw error;

      setMessages(prev => [...prev, { ...data, reactions: [], reads: [] }]);
      
    } catch (error) {
      console.error('❌ Failed to upload image:', error);
    } finally {
      setUploading(false);
    }
  };

  // リアクション追加/削除（楽観的更新）
  const handleReaction = async (messageId: string, emoji: string) => {
    if (!user?.id || !currentTrip?.id) return;

    try {
      // メッセージがこのトリップのものかチェック
      const message = messages.find(m => m.id === messageId);
      if (!message || message.trip_id !== currentTrip.id) {
        console.error('❌ Message not found or not in current trip');
        return;
      }

      // 既存のリアクションをチェック
      const existingReaction = message.reactions.find(r => r.user_id === user.id && r.emoji === emoji);
      
      // 楽観的更新：即座にUIを更新
      if (existingReaction) {
        // リアクション削除（楽観的）
        setMessages(prev => 
          prev.map(msg => 
            msg.id === messageId 
              ? {
                  ...msg,
                  reactions: msg.reactions.filter(r => r.id !== existingReaction.id)
                }
              : msg
          )
        );

        // サーバーに削除リクエスト
        const { error } = await supabase
          .from('message_reactions')
          .delete()
          .eq('id', existingReaction.id)
          .eq('user_id', user.id);

        if (error) {
          // エラー時：楽観的更新を元に戻す
          setMessages(prev => 
            prev.map(msg => 
              msg.id === messageId 
                ? {
                    ...msg,
                    reactions: [...msg.reactions, existingReaction]
                  }
                : msg
            )
          );
          throw error;
        }
      } else {
        // リアクション追加（楽観的）
        const newReaction = {
          id: `temp-${Date.now()}`,
          message_id: messageId,
          user_id: user.id,
          emoji: emoji,
          created_at: new Date().toISOString(),
          user: {
            id: user.id,
            name: user.name || 'You'
          }
        };

        setMessages(prev => 
          prev.map(msg => 
            msg.id === messageId 
              ? {
                  ...msg,
                  reactions: [...msg.reactions, newReaction]
                }
              : msg
          )
        );

        // サーバーに追加リクエスト
        const { data, error } = await supabase
          .from('message_reactions')
          .insert({
            message_id: messageId,
            user_id: user.id,
            emoji: emoji
          })
          .select('id, message_id, user_id, emoji, created_at')
          .single();

        if (error) {
          // 重複エラーでない場合は楽観的更新を元に戻す
          if (error.code !== '23505') {
            setMessages(prev => 
              prev.map(msg => 
                msg.id === messageId 
                  ? {
                      ...msg,
                      reactions: msg.reactions.filter(r => r.id !== newReaction.id)
                    }
                  : msg
              )
            );
            throw error;
          }
        } else if (data) {
          // 成功時：一時IDを実際のIDに置き換え
          setMessages(prev => 
            prev.map(msg => 
              msg.id === messageId 
                ? {
                    ...msg,
                    reactions: msg.reactions.map(r => 
                      r.id === newReaction.id 
                        ? { ...newReaction, id: data.id }
                        : r
                    )
                  }
                : msg
            )
          );
        }
      }

      setShowEmojiPicker(null);
    } catch (error) {
      console.error('❌ Failed to handle reaction:', error);
    }
  };

  // メッセージ既読
  const markMessagesAsRead = async (messageIds: string[]) => {
    if (!user?.id || messageIds.length === 0) return;

    try {
      const readData = messageIds.map(messageId => ({
        message_id: messageId,
        user_id: user.id
      }));

      const { error } = await supabase
        .from('message_reads')
        .upsert(readData, { onConflict: 'message_id,user_id' });

      if (error) throw error;
    } catch (error) {
      console.error('❌ Failed to mark messages as read:', error);
    }
  };

  // リアルタイム連携設定 (大手アプリスタイル)
  useEffect(() => {
    if (!currentTrip?.id || !user?.id) return;

    const channel = supabase
      .channel(`chat:${currentTrip.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `trip_id=eq.${currentTrip.id}`
        },
        async (payload) => {
          // 自分が送信したメッセージでない場合のみ処理
          if (payload.new.user_id !== user.id) {
            // 新しいメッセージを取得（関連データも含む）
            const { data } = await supabase
              .from('chat_messages')
              .select(`
                *,
                user:users(id, name, avatar_url),
                reactions:message_reactions(
                  id, emoji, user_id, created_at,
                  user:users(id, name)
                ),
                reads:message_reads(
                  id, user_id, read_at,
                  user:users(id, name)
                )
              `)
              .eq('id', payload.new.id)
              .single();

            if (data) {
              setMessages(prev => {
                // 重複チェック
                if (prev.some(msg => msg.id === data.id)) {
                  return prev;
                }
                return [...prev, data];
              });
              
              // 受信したメッセージを既読にする
              await markMessagesAsRead([data.id]);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_reactions'
        },
        async (payload) => {
          // 自分のリアクションでない場合のみ処理（楽観的更新と重複回避）
          if (payload.new.user_id !== user.id) {
            const { data: reactionData } = await supabase
              .from('message_reactions')
              .select('id, message_id, user_id, emoji, created_at, user:users(id, name)')
              .eq('id', payload.new.id)
              .single();

            if (reactionData) {
              setMessages(prev => 
                prev.map(msg => 
                  msg.id === reactionData.message_id
                    ? {
                        ...msg,
                        reactions: [...msg.reactions, reactionData]
                      }
                    : msg
                )
              );
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'message_reactions'
        },
        (payload) => {
          // 削除されたリアクションを除去
          if (payload.old.user_id !== user.id) {
            setMessages(prev => 
              prev.map(msg => ({
                ...msg,
                reactions: msg.reactions.filter(r => r.id !== payload.old.id)
              }))
            );
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_reads'
        },
        async (payload) => {
          // 自分の既読でない場合のみ処理
          if (payload.new.user_id !== user.id) {
            const { data: readData } = await supabase
              .from('message_reads')
              .select('id, message_id, user_id, read_at, user:users(id, name)')
              .eq('id', payload.new.id)
              .single();

            if (readData) {
              setMessages(prev => 
                prev.map(msg => 
                  msg.id === readData.message_id
                    ? {
                        ...msg,
                        reads: [...msg.reads, readData]
                      }
                    : msg
                )
              );
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentTrip?.id, user?.id]);

  // 現在のユーザーのカラー取得 (memberColors は store から取得)
  const loadCurrentUserColor = useCallback(async () => {
    if (!currentTrip?.id || !user?.id) return;

    try {
      // 現在のユーザーのカラーを取得
      const userColor = await MemberColorService.getMemberColor(currentTrip.id, user.id);
      setCurrentUserColor(userColor);
      
      // ユーザーにカラーが割り当てられていない場合は割り当て
      if (!userColor) {
        const assignedColor = await MemberColorService.assignColorToMember(currentTrip.id, user.id);
        setCurrentUserColor(assignedColor);
      }
    } catch (error) {
      console.error('❌ Failed to load current user color:', error);
    }
  }, [currentTrip?.id, user?.id]);

  // 初期データ読み込み
  useEffect(() => {
    loadMessages();
    loadCurrentUserColor();
  }, [loadMessages, loadCurrentUserColor]);

  // 自動スクロール
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // モーダル外クリックでクローズ
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showReadDetails) {
        const target = event.target as Element;
        if (!target.closest('[data-read-details]') && !target.closest('button')) {
          setShowReadDetails(null);
        }
      }
      if (showEmojiPicker) {
        const target = event.target as Element;
        if (!target.closest('.emoji-picker') && !target.closest('[data-emoji-trigger]')) {
          setShowEmojiPicker(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showReadDetails, showEmojiPicker]);

  // ファイル選択
  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleImageUpload(file);
    }
    e.target.value = '';
  };

  // 既読状態のヘルパー関数
  const getReadStatus = (message: ChatMessage) => {
    if (message.user_id !== user?.id) return null;
    
    const readCount = message.reads?.length || 0;
    const tripMemberCount = currentTrip?.memberCount || 1;
    
    if (readCount >= tripMemberCount - 1) { // 自分以外全員が既読
      return 'all-read';
    } else if (readCount > 0) {
      return 'some-read';
    }
    return 'unread';
  };

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-slate-900">
      {/* Chat Header */}
      <div className="p-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {currentTrip?.name || 'Trip Chat'}
            </h1>
            <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-400 rounded-full mr-1"></div>
                <span>{currentTrip?.memberCount || 0} member{currentTrip?.memberCount !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <Send className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
              No messages yet
            </h3>
            <p className="text-slate-600 dark:text-slate-400 max-w-sm">
              Start the conversation by sending the first message to your trip members.
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isOwn = msg.user_id === user?.id;
            const readStatus = getReadStatus(msg);
            
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex space-x-3 max-w-xs lg:max-w-md ${isOwn ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  {!isOwn && (
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ 
                        backgroundColor: memberColors[msg.user_id] || '#6B7280',
                        color: MemberColorService.getContrastColor(memberColors[msg.user_id] || '#6B7280')
                      }}
                    >
                      <span className="font-medium text-sm">
                        {msg.user.name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  
                  <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                    {!isOwn && (
                      <span className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                        {msg.user.name}
                      </span>
                    )}

                    
                    <div className="relative group">
                      {msg.message_type === 'image' ? (
                        <div className={`rounded-2xl overflow-hidden ${isOwn ? 'ml-8' : 'mr-8'}`}>
                          <img
                            src={msg.image_url || ''}
                            alt="Shared image"
                            className="max-w-xs max-h-64 object-cover"
                          />
                        </div>
                      ) : (
                        <div className={`px-4 py-2 rounded-2xl ${
                          isOwn
                            ? 'bg-indigo-500 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                        }`}>
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      )}

                      {/* Message actions */}
                      <div className={`absolute top-0 ${isOwn ? 'left-0 transform -translate-x-full' : 'right-0 transform translate-x-full'} opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg px-2 py-1`}>
                        <button
                          onClick={() => setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id)}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                          title="React"
                          data-emoji-trigger
                        >
                          <Smile className="w-3 h-3 text-slate-500" />
                        </button>
                      </div>

                      {/* Emoji picker */}
                      <AnimatePresence>
                        {showEmojiPicker === msg.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className={`absolute z-10 ${isOwn ? 'right-0' : 'left-0'} mt-2 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 p-2 emoji-picker`}
                          >
                            <div className="flex space-x-1">
                              {commonEmojis.map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => handleReaction(msg.id, emoji)}
                                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Reactions */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1 max-w-xs">
                        {Object.entries(
                          msg.reactions.reduce((acc, reaction) => {
                            if (!acc[reaction.emoji]) acc[reaction.emoji] = [];
                            acc[reaction.emoji].push(reaction);
                            return acc;
                          }, {} as Record<string, typeof msg.reactions>)
                        ).map(([emoji, reactions]) => (
                          <button
                            key={emoji}
                            onClick={() => handleReaction(msg.id, emoji)}
                            className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs transition-colors ${
                              reactions.some(r => r.user_id === user?.id)
                                ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                            title={reactions.map(r => r.user.name).join(', ')}
                          >
                            <span>{emoji}</span>
                            <span>{reactions.length}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    
                    <div className={`flex items-center space-x-2 mt-1 ${isOwn ? 'flex-row-reverse space-x-reverse' : ''}`}>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      
                      {/* Read status for own messages */}
                      {isOwn && readStatus && (
                        <div className="flex items-center">
                          {readStatus === 'all-read' ? (
                            <CheckCheck className="w-3 h-3 text-blue-500" title="Read by everyone" />
                          ) : readStatus === 'some-read' ? (
                            <CheckCheck className="w-3 h-3 text-slate-400" title="Read by some" />
                          ) : (
                            <Check className="w-3 h-3 text-slate-400" title="Sent" />
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Read indicators below message (only for own messages) */}
                    {isOwn && msg.reads && msg.reads.length > 0 && (
                      <div className="flex items-center space-x-1 mt-1 justify-end relative">
                        <button
                          onClick={() => setShowReadDetails(showReadDetails === msg.id ? null : msg.id)}
                          className="flex items-center space-x-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded px-1 py-0.5 transition-colors"
                        >
                          {msg.reads.slice(0, 3).map((read) => {
                            const memberColor = memberColors[read.user_id] || '#6B7280';
                            return (
                              <div 
                                key={read.id}
                                className="w-3 h-3 rounded-full border border-white"
                                style={{ backgroundColor: memberColor }}
                              />
                            );
                          })}
                          {msg.reads.length > 3 && (
                            <span className="text-xs text-slate-400 ml-1">+{msg.reads.length - 3}</span>
                          )}
                        </button>

                        {/* Read details modal */}
                        <AnimatePresence>
                          {showReadDetails === msg.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.9, y: 10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.9, y: 10 }}
                              className="absolute bottom-full right-0 mb-2 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 min-w-64 max-w-sm z-50"
                              data-read-details
                            >
                              <div className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 flex items-center">
                                    <Clock className="w-4 h-4 mr-2" />
                                    Read by {msg.reads.length} {msg.reads.length === 1 ? 'person' : 'people'}
                                  </h3>
                                  <button
                                    onClick={() => setShowReadDetails(null)}
                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                                  >
                                    <X className="w-4 h-4 text-slate-500" />
                                  </button>
                                </div>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                  {msg.reads
                                    .sort((a, b) => new Date(b.read_at).getTime() - new Date(a.read_at).getTime())
                                    .map((read) => {
                                      const memberColor = memberColors[read.user_id] || '#6B7280';
                                      return (
                                        <div key={read.id} className="flex items-center space-x-3 py-2">
                                          <div 
                                            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                                            style={{ 
                                              backgroundColor: memberColor,
                                              color: MemberColorService.getContrastColor(memberColor)
                                            }}
                                          >
                                            <span className="font-medium text-sm">
                                              {read.user.name?.charAt(0).toUpperCase()}
                                            </span>
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                                              {read.user.name}
                                            </div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                              {new Date(read.read_at).toLocaleString([], {
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                              })}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="fixed bottom-16 left-0 right-0 p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
        <div className="flex items-center space-x-3">
          <button 
            onClick={handleFileSelect}
            disabled={uploading}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            title="Upload image"
          >
            {uploading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-500"></div>
            ) : (
              <ImageIcon className="w-5 h-5 text-slate-500" />
            )}
          </button>
          
          <div className="flex-1 relative">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-full bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              disabled={uploading}
            />
          </div>
          
          <button
            onClick={handleSendMessage}
            disabled={!message.trim() || uploading}
            className="p-2 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-300 dark:disabled:bg-slate-600 rounded-full transition-colors disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
}