import {
  Search,
  MessageCircle,
  FileText,
  Video,
  Mail,
  Phone,
  ChevronRight,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChartCard } from "@/components/dashboard"

// FAQ items
const faqs = [
  {
    question: "How do I create a new campaign?",
    answer: "Navigate to Campaigns page and click 'Create Campaign' button. Follow the wizard to set up your campaign details.",
  },
  {
    question: "How to add new inventory assets?",
    answer: "Go to Inventory Management, click 'Add New Asset', and fill in the required information about your media slot.",
  },
  {
    question: "How do I track campaign performance?",
    answer: "Visit the Analytics page for detailed metrics. You can also view individual campaign stats from the Campaigns section.",
  },
  {
    question: "How to generate reports?",
    answer: "Go to Analytics > Export Report to generate and download comprehensive reports in various formats.",
  },
]

// Resource links
const resources = [
  {
    icon: FileText,
    title: "Documentation",
    description: "Comprehensive guides and API references",
    link: "#",
  },
  {
    icon: Video,
    title: "Video Tutorials",
    description: "Step-by-step video guides",
    link: "#",
  },
  {
    icon: MessageCircle,
    title: "Community Forum",
    description: "Connect with other users",
    link: "#",
  },
]

const SupportPage = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold">How can we help you?</h1>
        <p className="text-muted-foreground mt-2">
          Search our knowledge base or get in touch with our support team
        </p>
        
        {/* Search */}
        <div className="relative mt-6">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search for help articles..."
            className="h-14 w-full rounded-2xl border border-border bg-card pl-12 pr-4 text-base outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Quick Resources */}
      <div className="grid gap-4 sm:grid-cols-3">
        {resources.map((resource) => (
          <div
            key={resource.title}
            className="rounded-2xl bg-card border border-border p-5 hover:bg-card/80 transition-colors cursor-pointer group"
          >
            <div className="flex items-start justify-between">
              <div className="rounded-xl bg-primary/20 p-3">
                <resource.icon className="h-6 w-6 text-primary" />
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <h3 className="mt-4 font-semibold">{resource.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{resource.description}</p>
          </div>
        ))}
      </div>

      {/* FAQ Section */}
      <ChartCard title="Frequently Asked Questions" subtitle="Quick answers to common questions">
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="rounded-xl bg-secondary/50 p-4 hover:bg-secondary transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-medium">{faq.question}</h4>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{faq.answer}</p>
            </div>
          ))}
        </div>
      </ChartCard>

      {/* Contact Support */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Contact Support" subtitle="Get help from our team">
          <div className="space-y-4">
            <div className="flex items-center gap-4 rounded-xl bg-secondary/50 p-4">
              <div className="rounded-xl bg-blue-500/20 p-3">
                <Mail className="h-5 w-5 text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Email Support</p>
                <p className="text-sm text-muted-foreground">support@mediaflow.com</p>
              </div>
              <Button variant="outline" className="rounded-xl">
                Send Email
              </Button>
            </div>
            <div className="flex items-center gap-4 rounded-xl bg-secondary/50 p-4">
              <div className="rounded-xl bg-green-500/20 p-3">
                <Phone className="h-5 w-5 text-green-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Phone Support</p>
                <p className="text-sm text-muted-foreground">+1 (800) 123-4567</p>
              </div>
              <Button variant="outline" className="rounded-xl">
                Call Now
              </Button>
            </div>
            <div className="flex items-center gap-4 rounded-xl bg-secondary/50 p-4">
              <div className="rounded-xl bg-purple-500/20 p-3">
                <MessageCircle className="h-5 w-5 text-purple-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Live Chat</p>
                <p className="text-sm text-muted-foreground">Available 24/7</p>
              </div>
              <Button className="rounded-xl bg-primary text-white hover:bg-primary/90">
                Start Chat
              </Button>
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Submit a Ticket" subtitle="Describe your issue">
          <form className="space-y-4">
            <div>
              <label className="text-sm font-medium">Subject</label>
              <input
                type="text"
                placeholder="Brief description of your issue"
                className="mt-2 h-11 w-full rounded-xl border border-border bg-secondary/50 px-4 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Category</label>
              <select className="mt-2 h-11 w-full rounded-xl border border-border bg-secondary/50 px-4 text-sm outline-none focus:border-primary">
                <option>Technical Issue</option>
                <option>Billing Question</option>
                <option>Feature Request</option>
                <option>General Inquiry</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <textarea
                rows={4}
                placeholder="Please describe your issue in detail..."
                className="mt-2 w-full rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm outline-none focus:border-primary resize-none"
              />
            </div>
            <Button className="w-full rounded-xl bg-primary text-white hover:bg-primary/90">
              Submit Ticket
            </Button>
          </form>
        </ChartCard>
      </div>
    </div>
  )
}

export default SupportPage
