'use client'
import { useEffect, useState } from 'react'

import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { RocketIcon } from "@radix-ui/react-icons"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"

import Event from './Event'

// On importe les données du contrat
import { contractAddress, contractAbi } from '@/constants'

// On importe les éléments de Wagmi qui vont nous permettre de :
/*
useReadContract : Lire les données d'un contrat
useAccount : Récupérer les données d'un compte connecté à la DApp via RainbowKit
useWriteContract : Ecrire des données dans un contrat
useWaitForTransactionReceipt : Attendre que la transaction soit confirmée (équivalent de transaction.wait() avec ethers)
useWatchContractEvent : Récupérer en temps réel si un évènement a été émis
*/
import { useReadContract, useAccount, useWriteContract, useWaitForTransactionReceipt, useWatchContractEvent } from 'wagmi'

// Permet de parser l'event
import { parseAbiItem } from 'viem'
// On importe le publicClient créé (voir ce fichier pour avoir les commentaires sur ce que fait réellement ce publicClient)
import { publicClient } from '../../utils/client'

const SimpleStorage = () => {
    // On récupère l'adresse connectée à la DApp
    const { address } = useAccount();

    // Un State pour stocker le nombre de l'input
    const [number, setNumber] = useState(null);
    // Un State pour stocker les events
    const [events, setEvents] = useState([])

    const { toast } = useToast()

    // Lis des données d'un contrat
    // data renommé en numberGet : le nombre sur la blockchain
    // error renommé en getError : Il y a-t-il une erreur lors de la lecture du nombre dans le contrat ?
    // isPending renommé en getIsPending : Pour savoir si on est en train de fetch le nombre
    // refetch (pas renommé) : Permet de rappeler par la suite cette fonction
    const { data: numberGet, error: getError, isPending: getIsPending, refetch } = useReadContract({
        // adresse du contrat
        address: contractAddress,
        // abi du contrat
        abi: contractAbi,
        // nom de la fonction dans le smart contract
        functionName: 'retrieve',
        // qui appelle la fonction ?
        account: address
    })

    // Permet d'écrire dans un contrat (et donc de faire une transaction)
    // data renommé en hash : le hash de la transaction
    // error (non renommé) : il y a t-il une erreur ?
    // isPending renommé en setIsPending : est-on en train d'écrire dans le contrat ?
    // writeContract : on pourra appeler cette fonction pour ensuite vraiment écrire dans le contrat plus tard
    const { data: hash, error, isPending: setIsPending, writeContract } = useWriteContract({
        mutation: {
            // La transaction a été lancée (pertinent sur Sepolia ou Mainnet, sur Hardhat les blocs sont inclus directement)
            // onSuccess: () => {
            //     toast({
            //         title: "Félicitations",
            //         description: "La transaction du withdraw a été lancée",
            //     });
            // },
            // Si erreur
            // onError: (error) => {
            //     toast({
            //         title: "Erreur",
            //         description: error.shortMessage,
            //     });
            // },
        }
    });

    // Lorsque l'utilisateur clique sur le bouton set
    const setTheNumber = async() => {
        // alors on écrit vraiment dans le contrat intelligent (fonction store du contrat)
        writeContract({ 
            address: contractAddress, 
            abi: contractAbi,
            functionName: 'store', 
            args: [number], 
        }) 
    }

    // Equivalent de transaction.wait() en ethersjs, on récupère si la transaction est en train d'être intégré dans un bloc (isConfirming) et si ça a marché au final (isConfirmed), il faut passer en paramètre le hash de la transaction (voir ci-dessus)
    const { isLoading: isConfirming, isSuccess, error: errorConfirmation } = 
    useWaitForTransactionReceipt({ 
        hash,
    })

    const refetchEverything = async() => {
        await refetch();
        await getEvents();
    }

    useEffect(() => {
        if(isSuccess) {
            toast({
                title: "Félicitations",
                description: "Votre nombre a été inscrit dans la Blockchain",
                className: "bg-lime-200"
            })
            refetchEverything();
        }
        if(errorConfirmation) {
            toast({
                title: errorConfirmation.message,
                status: "error",
                duration: 3000,
                isClosable: true,
            });
        }
    }, [isSuccess, errorConfirmation])

    // Check en direct si un évènement particulier est émis (vous pouvez décommenter pour voir le résultat au besoin)
    // useWatchContractEvent({
    //     address: contractAddress,
    //     abi: contractAbi,
    //     eventName: 'NumberChanged',
    //     onLogs(logs) {
    //         toast({
    //             title: "Un nouvel event est arrivé !",
    //             status: "success",
    //             duration: 3000,
    //             isClosable: true,
    //         });
    //     },
    // })

    // Get all the events 
    // Récupère tous les events, pour cela getLogs de Viem est de loin le plus efficace
    const getEvents = async() => {
        // On récupère tous les events NumberChanged
        const numberChangedLog = await publicClient.getLogs({
            address: contractAddress,
            event: parseAbiItem('event NumberChanged(uint oldValue, uint newValue)'),
            // du premier bloc
            fromBlock: 0n,
            // jusqu'au dernier
            toBlock: 'latest' // Pas besoin valeur par défaut
        })
        // Et on met ces events dans le state "events" en formant un objet cohérent pour chaque event
        setEvents(numberChangedLog.map(
            log => ({
                oldValue: log.args.oldValue.toString(),
                newValue: log.args.newValue.toString()
            })
        ))
    }

    // Lorsque l'on a qqn qui est connecté, on fetch les events
    useEffect(() => {
        const getAllEvents = async() => {
            if(address !== 'undefined') {
                await getEvents();
            }
        }
        getAllEvents()
    }, [address])

    return (
    <div className="flex flex-col w-full">
        <h2 class="mb-4 text-4xl">Get</h2>
        <div className="flex">
            {/* Est ce qu'on est en train de récupérer le nombre ? */}
            {getIsPending ? (
                <div>Chargement...</div>
            ) : (
                <p>The number in the Blockchain : <span className="font-bold">{numberGet?.toString()}</span></p>
            )}
        </div>
        <h2 class="mt-6 mb-4 text-4xl">Set</h2>
        <div direction="flex flex-col w-full">
            {hash && 
                <Alert className="mb-4 bg-lime-200">
                    <RocketIcon className="h-4 w-4" />
                    <AlertTitle>Information</AlertTitle>
                    <AlertDescription>
                        Transaction Hash: {hash}
                    </AlertDescription>
                </Alert>
            }
            {isConfirming && 
                <Alert className="mb-4 bg-amber-200">
                    <RocketIcon className="h-4 w-4" />
                    <AlertTitle>Information</AlertTitle>
                    <AlertDescription>
                        Waiting for confirmation...
                    </AlertDescription>
                </Alert>
            }
            {isSuccess && 
                <Alert className="mb-4 bg-lime-200">
                    <RocketIcon className="h-4 w-4" />
                    <AlertTitle>Information</AlertTitle>
                    <AlertDescription>
                        Transaction confirmed.
                    </AlertDescription>
                </Alert>
            }
            {errorConfirmation && (
                <Alert className="mb-4 bg-red-400">
                    <RocketIcon className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>
                        {(errorConfirmation).shortMessage || errorConfirmation.message}
                    </AlertDescription>
                </Alert>
            )}
            {error && (
                <Alert className="mb-4 bg-red-400">
                    <RocketIcon className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>
                        {(error).shortMessage || error.message}
                    </AlertDescription>
                </Alert>
            )} 
        </div>
        <div className="flex">
            <Input placeholder='Your number' onChange={(e) => setNumber(e.target.value)} />
            <Button variant="outline"disabled={setIsPending} onClick={setTheNumber}>{setIsPending ? 'Setting...' : 'Set'}</Button>
        </div>
        <h2 class="mt-6 mb-4 text-4xl">Events</h2>
        <div className='flex flex-col w-full'>
            {/* Ici, il faut afficher la liste des events si on a des events. Il faut toujours avoir une clé unique au niveau des éléments d'un map dans reactjs, pour cela on peut utiliser aussi crypto.randomUUID() */}
            {events && events.map((event) => {
                return (
                    <Event event={event} />
                )
            })}
        </div>
    </div>
  )
}

export default SimpleStorage