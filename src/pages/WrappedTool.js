import { Suspense, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from 'react-helmet-async';
import { AlertTriangle, Zap, ArrowLeft } from 'lucide-react';
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";

function WrappedTool(props) {
  const { tool } = props;
  const [ proceed, setProceed ] = useState(false);

  return (
    <>
      <Helmet>
        <title>good.tools · {tool.title}</title>
        <meta name="description" content={tool.description} />
        <meta name="keywords" content={tool.tags.join(",")} />
      </Helmet>
      
      <Link 
        to="/" 
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 group"
      >
        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
        Back to tools
      </Link>
      
      <div className="mb-8 animate-in">
        <h1 className="text-3xl md:text-4xl font-bold mb-3 text-foreground">
          {tool.title}
        </h1>
        <p className="text-base text-muted-foreground">{tool.description}</p>
      </div>
      
      {tool.warning && !proceed ? (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 animate-in">
          <CardHeader>
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 mb-2">
              <AlertTriangle className="w-5 h-5" />
              <CardTitle className="text-xl">Warning</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-foreground mb-4">
              <tool.warning />
            </div>
            <p className="text-muted-foreground mb-4">Proceed at your own risk.</p>
            <Button onClick={() => setProceed(true)}>Continue</Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="animate-in">
          <CardContent className="p-6">
            <Suspense fallback={
              <div className="flex items-center justify-center py-16">
                <div className="text-muted-foreground">Loading...</div>
              </div>
            }>
              <tool.component />
            </Suspense>
          </CardContent>
        </Card>
      )}
      
      {typeof tool.dependencies !== "undefined" && (
        <Card className="mt-8 animate-in">
          <CardContent className="p-6">
            {tool.online && (
              <div className="text-sm flex items-center gap-2 mb-4 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>This is an online tool, the data you submit gets processed on a remote server.</span>
              </div>
            )}
            <div className="text-sm flex items-start gap-2 text-muted-foreground">
              <Zap className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="mr-2">Built using</span>
                <div className="inline-flex flex-wrap gap-2 mt-2">
                  {tool.dependencies.map((d, i) => (
                    <Badge 
                      key={`tag-${i}`} 
                      variant="secondary"
                      className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                    >
                      {d.url ? (
                        <a href={d.url} target="_blank" rel="noopener noreferrer">
                          {d.name}
                        </a>
                      ) : (
                        d.name
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}

export default WrappedTool