import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Layout } from '@/components/Layout';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Search, FileText, ChevronRight, ChevronDown, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

// Import the raw markdown content
import qaGauntletContent from '../../docs/QA_GAUNTLET.md?raw';

interface TocItem {
  level: number;
  text: string;
  id: string;
}

function extractToc(markdown: string): TocItem[] {
  const lines = markdown.split('\n');
  const toc: TocItem[] = [];
  for (const line of lines) {
    const match = line.match(/^(#{1,4})\s+(.+)/);
    if (match) {
      const level = match[1].length;
      const text = match[2].replace(/[`*_~]/g, '');
      const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
      toc.push({ level, text, id });
    }
  }
  return toc;
}

const DocsViewer = () => {
  const [search, setSearch] = useState('');
  const [tocOpen, setTocOpen] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const toc = extractToc(qaGauntletContent);

  useEffect(() => {
    const handleScroll = () => {
      const scrollArea = document.getElementById('docs-scroll-area');
      if (scrollArea) {
        setShowScrollTop(scrollArea.scrollTop > 400);
      }
    };
    const el = document.getElementById('docs-scroll-area');
    el?.addEventListener('scroll', handleScroll);
    return () => el?.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const scrollToTop = () => {
    const el = document.getElementById('docs-scroll-area');
    el?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredToc = search
    ? toc.filter(item => item.text.toLowerCase().includes(search.toLowerCase()))
    : toc;

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 md:px-6 py-3 border-b border-border bg-surface-raised/50">
          <FileText className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">QA Gauntlet</h1>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            docs/QA_GAUNTLET.md
          </span>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar TOC */}
          <aside className="hidden md:flex flex-col w-72 border-r border-border bg-background">
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search sections…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
              </div>
            </div>
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Table of Contents
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setTocOpen(!tocOpen)}
              >
                {tocOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </Button>
            </div>
            {tocOpen && (
              <ScrollArea className="flex-1">
                <nav className="px-2 pb-4 space-y-0.5">
                  {filteredToc.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => scrollToSection(item.id)}
                      className={cn(
                        'w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors hover:bg-accent hover:text-accent-foreground truncate',
                        item.level === 1 && 'font-semibold text-foreground',
                        item.level === 2 && 'pl-4 text-foreground/90',
                        item.level === 3 && 'pl-6 text-muted-foreground text-xs',
                        item.level === 4 && 'pl-8 text-muted-foreground text-xs',
                      )}
                    >
                      {item.text}
                    </button>
                  ))}
                </nav>
              </ScrollArea>
            )}
          </aside>

          {/* Main content */}
          <div className="flex-1 overflow-hidden relative">
            <ScrollArea id="docs-scroll-area" className="h-full">
              <article className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-10">
                <div className="qa-docs-content prose prose-sm md:prose-base dark:prose-invert max-w-none
                  prose-headings:scroll-mt-4
                  prose-h1:text-2xl prose-h1:font-bold prose-h1:text-foreground prose-h1:border-b prose-h1:border-border prose-h1:pb-3
                  prose-h2:text-xl prose-h2:font-semibold prose-h2:text-foreground prose-h2:mt-10 prose-h2:mb-4
                  prose-h3:text-lg prose-h3:font-medium prose-h3:text-foreground/90
                  prose-p:text-muted-foreground prose-p:leading-relaxed
                  prose-li:text-muted-foreground
                  prose-strong:text-foreground
                  prose-code:text-primary prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono
                  prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:rounded-xl prose-pre:overflow-x-auto
                  prose-blockquote:border-l-primary prose-blockquote:bg-muted/50 prose-blockquote:rounded-r-lg prose-blockquote:py-1 prose-blockquote:px-4
                  prose-hr:border-border
                  prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                ">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ children, ...props }) => {
                        const text = String(children);
                        const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
                        return <h1 id={id} {...props}>{children}</h1>;
                      },
                      h2: ({ children, ...props }) => {
                        const text = String(children);
                        const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
                        return <h2 id={id} {...props}>{children}</h2>;
                      },
                      h3: ({ children, ...props }) => {
                        const text = String(children);
                        const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
                        return <h3 id={id} {...props}>{children}</h3>;
                      },
                      h4: ({ children, ...props }) => {
                        const text = String(children);
                        const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
                        return <h4 id={id} {...props}>{children}</h4>;
                      },
                      table: ({ children, ...props }) => (
                        <div className="overflow-x-auto rounded-xl border border-border my-4">
                          <table className="min-w-[800px] w-full text-xs border-collapse" {...props}>{children}</table>
                        </div>
                      ),
                      th: ({ children, ...props }) => (
                        <th className="bg-muted text-foreground text-xs font-semibold uppercase tracking-wider px-3 py-2 border border-border text-left whitespace-nowrap" {...props}>{children}</th>
                      ),
                      td: ({ children, ...props }) => (
                        <td className="text-muted-foreground text-xs px-3 py-2 border border-border align-top" {...props}>{children}</td>
                      ),
                    }}
                  >
                    {qaGauntletContent}
                  </ReactMarkdown>
                </div>
              </article>
            </ScrollArea>

            {/* Scroll to top */}
            {showScrollTop && (
              <Button
                variant="secondary"
                size="sm"
                className="fixed bottom-6 right-6 z-50 rounded-full h-10 w-10 p-0 shadow-lg"
                onClick={scrollToTop}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DocsViewer;
