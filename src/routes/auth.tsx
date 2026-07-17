import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FormEvent, useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Meu Churras — Login" },
      {
        name: "description",
        content: "Acesse sua conta do Meu Churras.",
      },
    ],
  }),
  component: AuthPage,
});


const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Informe um e-mail válido")
    .max(255),

  password: z
    .string()
    .min(6, "A senha deve ter no mínimo 6 caracteres")
    .max(72),
});


const signUpSchema = signInSchema.extend({

  fullName: z
    .string()
    .trim()
    .min(2, "Informe seu nome"),

  businessName: z
    .string()
    .trim()
    .min(2, "Informe o nome do negócio"),
});


function AuthPage() {

  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);



  useEffect(() => {

    supabase.auth.getSession()
      .then(({ data }) => {

        if(data.session){

          navigate({
            to:"/dashboard",
            replace:true
          });

        }

      });


  }, [navigate]);




  async function handleSignIn(
    e: FormEvent<HTMLFormElement>
  ){

    e.preventDefault();


    const form = new FormData(e.currentTarget);


    const parsed = signInSchema.safeParse(
      Object.fromEntries(form)
    );


    if(!parsed.success){

      toast.error(
        parsed.error.issues[0].message
      );

      return;
    }



    setLoading(true);



    const {
      error
    } = await supabase.auth.signInWithPassword(
      parsed.data
    );


    setLoading(false);



    if(error){

      toast.error(
        error.message
      );

      return;
    }



    toast.success(
      "Login realizado com sucesso!"
    );


    navigate({
      to:"/dashboard",
      replace:true
    });

  }





  async function handleSignUp(
    e: FormEvent<HTMLFormElement>
  ){

    e.preventDefault();


    const form = new FormData(e.currentTarget);



    const parsed =
      signUpSchema.safeParse(
        Object.fromEntries(form)
      );



    if(!parsed.success){

      toast.error(
        parsed.error.issues[0].message
      );

      return;

    }



    setLoading(true);



    const {
      error,
      data
    } = await supabase.auth.signUp({

      email:parsed.data.email,

      password:parsed.data.password,


      options:{

        emailRedirectTo:
          `${window.location.origin}/auth/callback`,


        data:{

          full_name:
            parsed.data.fullName,


          business_name:
            parsed.data.businessName,

        }

      }

    });



    setLoading(false);



    if(error){

      toast.error(
        error.message
      );

      return;

    }



    if(data.session){

      toast.success(
        "Conta criada com sucesso!"
      );


      navigate({
        to:"/dashboard",
        replace:true
      });


    }else{


      toast.success(
        "Confira seu e-mail para confirmar o cadastro."
      );

    }


  }






  async function handleGoogle(){

    setLoading(true);


    const result =
      await lovable.auth.signInWithOAuth(
        "google",
        {

          redirect_uri:
            `${window.location.origin}/auth/callback`

        }
      );



    if(result.error){

      setLoading(false);

      toast.error(
        "Erro ao entrar com Google"
      );

      return;

    }


  }





return (

<div className="min-h-screen grid lg:grid-cols-2 bg-background">


<div className="
hidden lg:flex flex-col justify-between
p-12 bg-gradient-to-br
from-orange-500 via-red-500
to-yellow-400 text-white
">


<div className="flex items-center gap-3">


<div className="
size-10 rounded-xl
bg-white/20 flex items-center
justify-center
">

<Building2 />

</div>


<div>

<div className="font-bold text-xl">
Meu Churras
</div>


<div className="text-xs opacity-80">
Gestão de churrasco
</div>


</div>


</div>




<div className="max-w-md">


<h1 className="
text-4xl font-bold
">

Seu churrasco organizado,
sem complicação.

</h1>


<p className="mt-4 opacity-90">

Controle clientes, eventos,
agenda e churrasqueiros em
um único lugar.

</p>


</div>



<p className="text-xs opacity-70">

© 2026 Meu Churras

</p>


</div>





<div className="
flex items-center justify-center
p-6
">


<div className="w-full max-w-md">


<Tabs defaultValue="signin">


<TabsList className="grid grid-cols-2">

<TabsTrigger value="signin">
Entrar
</TabsTrigger>


<TabsTrigger value="signup">
Criar conta
</TabsTrigger>


</TabsList>






<TabsContent value="signin">


<form
onSubmit={handleSignIn}
className="space-y-4 mt-6"
>


<div>

<Label>
E-mail
</Label>


<Input
name="email"
type="email"
/>


</div>




<div>

<Label>
Senha
</Label>


<Input
name="password"
type="password"
/>


</div>



<Button
className="w-full"
disabled={loading}
>

{
loading
?
"Entrando..."
:
"Entrar"
}


</Button>



</form>




<Button

variant="outline"

className="w-full mt-4"

onClick={handleGoogle}

>

Entrar com Google

</Button>



</TabsContent>







<TabsContent value="signup">


<form
onSubmit={handleSignUp}
className="space-y-4 mt-6"
>


<div>

<Label>
Nome
</Label>


<Input
name="fullName"
/>

</div>



<div>

<Label>
Nome do negócio
</Label>


<Input
name="businessName"
/>

</div>



<div>

<Label>
E-mail
</Label>


<Input
name="email"
type="email"
/>

</div>



<div>

<Label>
Senha
</Label>


<Input
name="password"
type="password"
/>

</div>




<Button
className="w-full"
disabled={loading}
>

{
loading
?
"Criando..."
:
"Criar conta"
}

</Button>



</form>


</TabsContent>




</Tabs>


</div>


</div>


</div>

);


}
