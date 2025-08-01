import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { X, Info, HelpCircle, MessageCircle, FileText, Phone, Heart, Mail, MapPin, Clock, Users, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';

// Feedback Form Component
const FeedbackForm = () => {
  const { user } = useStore();
  const [formData, setFormData] = useState({
    type: 'General Feedback',
    message: '',
    email: user?.email || ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.message.trim()) {
      setErrorMessage('Please enter your message');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    
    try {
      const { error } = await supabase
        .from('feedback')
        .insert({
          user_id: user?.id || null,
          feedback_type: formData.type,
          message: formData.message.trim(),
          email: formData.email.trim() || null,
          created_at: new Date().toISOString()
        });

      if (error) {
        throw error;
      }

      setSubmitStatus('success');
      setFormData({ type: 'General Feedback', message: '', email: user?.email || '' });
    } catch (error) {
      // Error occurred
      setSubmitStatus('error');
      setErrorMessage('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitStatus === 'success') {
    return (
      <motion.div 
        className="text-center py-8"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full mx-auto mb-4 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Thank you!</h3>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          Your feedback has been sent successfully. We appreciate your input!
        </p>
        <button
          onClick={() => setSubmitStatus('idle')}
          className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
        >
          Send Another
        </button>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Feedback Type
        </label>
        <select 
          value={formData.type}
          onChange={(e) => setFormData({ ...formData, type: e.target.value })}
          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
        >
          <option>Bug Report</option>
          <option>Feature Request</option>
          <option>General Feedback</option>
          <option>Compliment</option>
        </select>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Your Message
        </label>
        <textarea 
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          rows={4}
          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          placeholder="Tell us what's on your mind..."
          required
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Email (optional)
        </label>
        <input 
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          placeholder="your.email@example.com"
        />
      </div>
      
      {errorMessage && (
        <div className="flex items-center space-x-2 text-red-600 dark:text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>{errorMessage}</span>
        </div>
      )}
      
      <button 
        type="submit"
        disabled={isSubmitting || !formData.message.trim()}
        className="w-full px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
      >
        {isSubmitting ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            <span>Sending...</span>
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            <span>Send Feedback</span>
          </>
        )}
      </button>
    </form>
  );
};

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: string;
}

const getModalContent = (type: string) => {
  switch (type) {
    case 'about':
      return {
        title: 'About Voypath',
        icon: Info,
        content: (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-secondary-600 rounded-full mx-auto mb-4 flex items-center justify-center">
                <img 
                  src="/voypathlogo_nameunder.png" 
                  alt="Voypath" 
                  className="w-12 h-12 object-contain"
                />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Voypath</h3>
              <p className="text-slate-600 dark:text-slate-400">Smart Travel Planning Platform</p>
            </div>
            
            <div className="prose prose-slate dark:prose-invert max-w-none">
              <h4 className="text-lg font-semibold mb-3">Our Mission</h4>
              <p className="text-sm leading-relaxed mb-4">
                Voypath revolutionizes travel planning by using advanced AI algorithms to create perfectly 
                balanced itineraries that consider every group member's preferences, travel efficiency, 
                and fairness in place selection.
              </p>
              
              <h4 className="text-lg font-semibold mb-3">What Makes Us Special</h4>
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-start space-x-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <Users className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-blue-900 dark:text-blue-100">Fair Group Planning</div>
                    <div className="text-sm text-blue-700 dark:text-blue-300">Every member's preferences matter equally</div>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <MapPin className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-green-900 dark:text-green-100">Smart Optimization</div>
                    <div className="text-sm text-green-700 dark:text-green-300">AI-powered route optimization for maximum efficiency</div>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <Clock className="w-5 h-5 text-purple-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-purple-900 dark:text-purple-100">Real-time Collaboration</div>
                    <div className="text-sm text-purple-700 dark:text-purple-300">Plan together, travel better</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      };

    case 'help':
      return {
        title: 'Help Center',
        icon: HelpCircle,
        content: (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full mx-auto mb-4 flex items-center justify-center">
                <HelpCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">We're Here to Help</h3>
              <p className="text-slate-600 dark:text-slate-400">Get answers to common questions or contact our support team</p>
            </div>

            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Frequently Asked Questions</h4>
              
              <div className="space-y-3 max-h-80 overflow-y-auto">
                <details className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                  <summary className="font-medium cursor-pointer text-slate-900 dark:text-slate-100">How does the trip optimization work?</summary>
                  <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    Our AI algorithm considers each member's place preferences, wish levels, and travel constraints to create 
                    a balanced itinerary that maximizes satisfaction while minimizing travel time.
                  </div>
                </details>
                
                <details className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                  <summary className="font-medium cursor-pointer text-slate-900 dark:text-slate-100">Can I add places after optimization?</summary>
                  <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    Yes! You can add new places anytime and re-run the optimization to include them in your itinerary.
                  </div>
                </details>
                
                <details className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                  <summary className="font-medium cursor-pointer text-slate-900 dark:text-slate-100">How do I invite others to my trip?</summary>
                  <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    Go to the Share page and use the invitation code or share link to invite team members to collaborate on your trip.
                  </div>
                </details>

                <details className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                  <summary className="font-medium cursor-pointer text-slate-900 dark:text-slate-100">What's the difference between scheduled and pending places?</summary>
                  <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    Scheduled places have been confirmed in your optimized itinerary with specific dates and times. Pending places are under consideration but haven't been included in the final schedule yet.
                  </div>
                </details>

                <details className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                  <summary className="font-medium cursor-pointer text-slate-900 dark:text-slate-100">How do member colors work?</summary>
                  <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    Each trip member gets assigned a unique color that appears throughout the app - in place cards, chat messages, and read receipts. This helps you quickly identify who contributed what.
                  </div>
                </details>

                <details className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                  <summary className="font-medium cursor-pointer text-slate-900 dark:text-slate-100">Can I change the trip dates after creating it?</summary>
                  <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    Yes! Go to the trip settings to modify your departure date, arrival date, and duration. The optimization will automatically adjust to your new dates.
                  </div>
                </details>

                <details className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                  <summary className="font-medium cursor-pointer text-slate-900 dark:text-slate-100">What happens if I miss the add-place deadline?</summary>
                  <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    After the deadline, new places can't be added to maintain fairness. However, the trip creator can extend the deadline or adjust it in trip settings if needed.
                  </div>
                </details>

                <details className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                  <summary className="font-medium cursor-pointer text-slate-900 dark:text-slate-100">How does the fairness optimization work?</summary>
                  <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    Our algorithm balances each member's preferences to ensure everyone gets a fair representation of their desired places in the final itinerary, considering wish levels and member priorities.
                  </div>
                </details>

                <details className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                  <summary className="font-medium cursor-pointer text-slate-900 dark:text-slate-100">Can I use Voypath offline?</summary>
                  <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    Basic viewing is available offline, but adding places, optimization, and real-time collaboration require an internet connection. Premium users get enhanced offline access.
                  </div>
                </details>

                <details className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                  <summary className="font-medium cursor-pointer text-slate-900 dark:text-slate-100">How do I delete a trip?</summary>
                  <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    Go to trip settings and scroll to the bottom to find the delete option. Only trip creators can delete trips. This action is permanent and cannot be undone.
                  </div>
                </details>

                <details className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                  <summary className="font-medium cursor-pointer text-slate-900 dark:text-slate-100">What transportation modes are supported?</summary>
                  <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    Voypath supports walking, public transport, car/taxi, and flight options. You can set your preferred transportation mode in the optimization settings.
                  </div>
                </details>

                <details className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                  <summary className="font-medium cursor-pointer text-slate-900 dark:text-slate-100">How do I change my account settings?</summary>
                  <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    Click on your profile icon in the top-right corner and select "Profile" to access your account settings, including name, email, and notification preferences.
                  </div>
                </details>

                <details className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                  <summary className="font-medium cursor-pointer text-slate-900 dark:text-slate-100">What's included in Voypath Premium?</summary>
                  <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    Premium includes unlimited trips, advanced optimization features, priority support, offline access, premium themes, and early access to new features for $9.00/year.
                  </div>
                </details>

                <details className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                  <summary className="font-medium cursor-pointer text-slate-900 dark:text-slate-100">How do I export my trip data?</summary>
                  <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    Premium users can export trip data in various formats from the trip settings menu. This includes itineraries, place lists, and schedule information.
                  </div>
                </details>

                <details className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                  <summary className="font-medium cursor-pointer text-slate-900 dark:text-slate-100">Is my data secure and private?</summary>
                  <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    Yes! We use industry-standard encryption and secure servers. Your trip data is private to your group members only, and we never share personal information with third parties.
                  </div>
                </details>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                <h4 className="text-md font-semibold text-slate-900 dark:text-slate-100 mb-3">Contact Support</h4>
                <div className="space-y-2">
                  <div className="flex items-center space-x-3 text-sm">
                    <Mail className="w-4 h-4 text-slate-500" />
                    <span className="text-slate-600 dark:text-slate-400">voypath@gmail.com</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      };

    case 'feedback':
      return {
        title: 'Send Feedback',
        icon: MessageCircle,
        content: (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full mx-auto mb-4 flex items-center justify-center">
                <MessageCircle className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">We Value Your Feedback</h3>
              <p className="text-slate-600 dark:text-slate-400">Help us improve Voypath by sharing your thoughts and suggestions</p>
            </div>

            <FeedbackForm />
          </div>
        )
      };

    case 'terms':
      return {
        title: 'Terms of Service',
        icon: FileText,
        content: (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/20 rounded-full mx-auto mb-4 flex items-center justify-center">
                <FileText className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Terms of Service</h3>
              <p className="text-slate-600 dark:text-slate-400">Last updated: January 2024</p>
            </div>

            <div className="prose prose-slate dark:prose-invert max-w-none text-sm">
              <h4 className="text-md font-semibold mb-3">1. Acceptance of Terms</h4>
              <p className="mb-4">
                By accessing and using Voypath, you accept and agree to be bound by the terms and provision of this agreement.
              </p>

              <h4 className="text-md font-semibold mb-3">2. Use License</h4>
              <p className="mb-4">
                Permission is granted to temporarily use Voypath for personal, non-commercial transitory viewing only.
                This is the grant of a license, not a transfer of title.
              </p>

              <h4 className="text-md font-semibold mb-3">3. User Account</h4>
              <p className="mb-4">
                You are responsible for safeguarding the password and for all activities that occur under your account.
                You agree not to disclose your password to any third party.
              </p>

              <h4 className="text-md font-semibold mb-3">4. Privacy Policy</h4>
              <p className="mb-4">
                Your privacy is important to us. Please review our Privacy Policy, which also governs your use of the Service.
              </p>

              <h4 className="text-md font-semibold mb-3">5. Prohibited Uses</h4>
              <ul className="list-disc list-inside mb-4 space-y-1">
                <li>Use the service for any unlawful purpose</li>
                <li>Attempt to gain unauthorized access to any systems</li>
                <li>Interfere with or disrupt the service</li>
                <li>Upload malicious code or harmful content</li>
              </ul>

              <h4 className="text-md font-semibold mb-3">6. Contact Information</h4>
              <p>
                If you have any questions about these Terms of Service, please contact us at voypath@gmail.com
              </p>
            </div>
          </div>
        )
      };

    case 'contact':
      return {
        title: 'Contact Us',
        icon: Phone,
        content: (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/20 rounded-full mx-auto mb-4 flex items-center justify-center">
                <Phone className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Get In Touch</h3>
              <p className="text-slate-600 dark:text-slate-400">We'd love to hear from you. Choose your preferred way to contact us.</p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <div className="flex items-center space-x-3 mb-2">
                  <Mail className="w-5 h-5 text-blue-600" />
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100">Email Support</h4>
                </div>
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                  Get help with technical issues or general questions
                </p>
                <a href="mailto:voypath@gmail.com" className="text-blue-600 dark:text-blue-400 text-sm font-medium">
                  voypath@gmail.com
                </a>
              </div>

            </div>

          </div>
        )
      };


    default:
      return {
        title: 'Information',
        icon: Info,
        content: <div>Content not found</div>
      };
  }
};

export function InfoModal({ isOpen, onClose, type }: InfoModalProps) {
  const { title, icon: Icon, content } = getModalContent(type);

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-[9999]">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-2 pt-16 pb-16 sm:p-4 sm:pt-6 sm:pb-6">
        <Dialog.Panel
          as={motion.div}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-2xl max-h-[85vh] sm:max-h-[90vh] bg-white dark:bg-slate-800 rounded-xl shadow-xl overflow-hidden"
        >
          <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-primary-500 to-secondary-600">
            <Dialog.Title className="text-xl font-semibold text-white flex items-center space-x-3">
              <Icon className="w-6 h-6" />
              <span>{title}</span>
            </Dialog.Title>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 120px)' }}>
            {content}
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}