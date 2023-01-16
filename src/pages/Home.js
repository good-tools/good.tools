import { Helmet } from 'react-helmet-async';
import { HeroPattern } from '../components/HeroPattern';

function Home() {

  return (
    <>
      <Helmet>
        <title>good.tools · Purpose built online tools</title>
        <meta name="description" content={"Purpose built, online, free-to-use tools"} />
      </Helmet>
      <HeroPattern />
      <div className='py-8'>
        <article className='prose dark:prose-invert'>
          <h1>Purpose built, online, free-to-use tools</h1>
          <p className='lead'>
            The goal is to create useful general, development and security tools that run in the browser.
            Some tools however do require sending data to a remote server for processing.
            In such cases, it will be explicitly mentioned.
          </p>
          <p className='lead flex'>
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="mt-0.4 h-6 w-6 mr-2">
              <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M6.75 15.75L3 12m0 0l3.75-3.75M3 12h18" />
            </svg>
            Select a tool from the sidebar to get started!
          </p>
        </article>
      </div>
    </>
  )
}

export default Home;
